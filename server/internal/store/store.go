package store

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	codeLength              = 4
	codeLifetime            = 100 * 365 * 24 * time.Hour
	signalTypePresence      = "presence"
	signalTypePresenceWatch = "presence-watch"
	signalTypeDeviceProfile = "device-profile"
	signalTypeLanDevices    = "lan-devices"
)

type pairing struct {
	DeviceID  string    `json:"deviceId"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type pairingResponse struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type presenceResponse struct {
	Devices []devicePresence `json:"devices"`
}

type devicePresence struct {
	DeviceID string `json:"deviceId"`
	Online   bool   `json:"online"`
}

type exchangeRequest struct {
	Code     string `json:"code"`
	DeviceID string `json:"deviceId"`
}

type exchangeResponse struct {
	PeerDeviceID string `json:"peerDeviceId"`
}

type signalMessage struct {
	To      string          `json:"to"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type presenceWatchRequest struct {
	DeviceIDs []string `json:"deviceIds"`
}

type lanDevicesRequest struct {
	DeviceID string `json:"deviceId"`
}

type lanDevicesResponse struct {
	Devices []lanDevice `json:"devices"`
}

type lanDevice struct {
	DeviceID string `json:"deviceId"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Online   bool   `json:"online"`
}

type deviceProfile struct {
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

type signalingClient struct {
	connection *websocket.Conn
	writeMutex sync.Mutex
	networkID  string
	profile    deviceProfile
}

func (client *signalingClient) WriteJSON(payload any) error {
	client.writeMutex.Lock()
	defer client.writeMutex.Unlock()
	return client.connection.WriteJSON(payload)
}

type Store struct {
	sync.Mutex
	pairs                 map[string]pairing
	deviceCodes           map[string]string
	clients               map[string]*signalingClient
	presenceTargets       map[string]map[string]struct{}
	presenceSubscriptions map[string]map[string]struct{}
}

var upgrader = websocket.Upgrader{CheckOrigin: func(_ *http.Request) bool { return true }}

func New() *Store {
	return &Store{
		pairs:                 make(map[string]pairing),
		deviceCodes:           make(map[string]string),
		clients:               make(map[string]*signalingClient),
		presenceTargets:       make(map[string]map[string]struct{}),
		presenceSubscriptions: make(map[string]map[string]struct{}),
	}
}

func (store *Store) Signal(w http.ResponseWriter, r *http.Request) {
	deviceID := r.URL.Query().Get("deviceId")
	if deviceID == "" {
		http.Error(w, "deviceId is required", http.StatusBadRequest)
		return
	}
	connection, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &signalingClient{
		connection: connection,
		networkID:  requestNetworkID(r),
		profile: deviceProfile{
			Nickname: strings.TrimSpace(r.URL.Query().Get("nickname")),
			Avatar:   strings.TrimSpace(r.URL.Query().Get("avatar")),
		},
	}
	store.Lock()
	previousClient := store.clients[deviceID]
	store.clients[deviceID] = client
	store.Unlock()
	if previousClient != nil {
		_ = previousClient.connection.Close()
	}
	store.broadcastPresence(deviceID, true)
	store.broadcastLanDevices(client.networkID)
	defer func() {
		removed := false
		store.Lock()
		if store.clients[deviceID] == client {
			delete(store.clients, deviceID)
			removed = true
		}
		store.Unlock()
		_ = connection.Close()
		if removed {
			store.broadcastPresence(deviceID, false)
			store.broadcastLanDevices(client.networkID)
		}
	}()

	for {
		var message signalMessage
		if err := connection.ReadJSON(&message); err != nil {
			return
		}
		if message.Type == signalTypePresenceWatch {
			var request presenceWatchRequest
			if json.Unmarshal(message.Payload, &request) == nil {
				store.setPresenceSubscriptions(deviceID, request.DeviceIDs)
			}
			continue
		}
		if message.Type == signalTypeDeviceProfile {
			var profile deviceProfile
			if json.Unmarshal(message.Payload, &profile) == nil {
				store.setClientProfile(deviceID, client, profile)
			}
			continue
		}
		if message.To == "" || message.Type == "" {
			continue
		}
		store.Lock()
		targetClient := store.clients[message.To]
		store.Unlock()
		if targetClient != nil {
			_ = targetClient.WriteJSON(map[string]any{"from": deviceID, "type": message.Type, "payload": message.Payload})
		}
	}
}

func (store *Store) setClientProfile(deviceID string, client *signalingClient, profile deviceProfile) {
	store.Lock()
	if store.clients[deviceID] != client {
		store.Unlock()
		return
	}
	client.profile = deviceProfile{Nickname: strings.TrimSpace(profile.Nickname), Avatar: strings.TrimSpace(profile.Avatar)}
	networkID := client.networkID
	store.Unlock()
	store.broadcastLanDevices(networkID)
}

func (store *Store) broadcastLanDevices(networkID string) {
	if networkID == "" {
		return
	}
	type delivery struct {
		client  *signalingClient
		devices []lanDevice
	}
	store.Lock()
	deliveries := make([]delivery, 0)
	for deviceID, client := range store.clients {
		if client.networkID != networkID {
			continue
		}
		deliveries = append(deliveries, delivery{client: client, devices: store.lanDevicesLocked(networkID, deviceID)})
	}
	store.Unlock()
	for _, item := range deliveries {
		_ = item.client.WriteJSON(map[string]any{"type": signalTypeLanDevices, "payload": lanDevicesResponse{Devices: item.devices}})
	}
}

func (store *Store) broadcastPresence(deviceID string, online bool) {
	store.Lock()
	clients := make([]*signalingClient, 0, len(store.presenceTargets[deviceID]))
	for subscriberID := range store.presenceTargets[deviceID] {
		if client := store.clients[subscriberID]; client != nil {
			clients = append(clients, client)
		}
	}
	store.Unlock()
	payload := map[string]any{"type": signalTypePresence, "payload": devicePresence{DeviceID: deviceID, Online: online}}
	for _, client := range clients {
		_ = client.WriteJSON(payload)
	}
}

func (store *Store) setPresenceSubscriptions(deviceID string, targetDeviceIDs []string) {
	store.Lock()
	defer store.Unlock()
	for targetDeviceID := range store.presenceSubscriptions[deviceID] {
		delete(store.presenceTargets[targetDeviceID], deviceID)
		if len(store.presenceTargets[targetDeviceID]) == 0 {
			delete(store.presenceTargets, targetDeviceID)
		}
	}
	targets := make(map[string]struct{})
	for _, targetDeviceID := range targetDeviceIDs {
		targetDeviceID = strings.TrimSpace(targetDeviceID)
		if targetDeviceID == "" || targetDeviceID == deviceID {
			continue
		}
		targets[targetDeviceID] = struct{}{}
		if store.presenceTargets[targetDeviceID] == nil {
			store.presenceTargets[targetDeviceID] = make(map[string]struct{})
		}
		store.presenceTargets[targetDeviceID][deviceID] = struct{}{}
	}
	if len(targets) == 0 {
		delete(store.presenceSubscriptions, deviceID)
		return
	}
	store.presenceSubscriptions[deviceID] = targets
}

func (store *Store) CreatePairing(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input struct {
		DeviceID     string `json:"deviceId"`
		ForceRefresh bool   `json:"forceRefresh"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.DeviceID) == "" {
		http.Error(w, "deviceId is required", http.StatusBadRequest)
		return
	}
	store.Lock()
	defer store.Unlock()
	if existingCode, ok := store.deviceCodes[input.DeviceID]; ok && !input.ForceRefresh {
		respondJSON(w, pairingResponse{Code: existingCode, ExpiresAt: store.pairs[existingCode].ExpiresAt})
		return
	}
	if previousCode, ok := store.deviceCodes[input.DeviceID]; ok {
		delete(store.pairs, previousCode)
	}
	code := store.newCode()
	expiration := time.Now().Add(codeLifetime)
	store.deviceCodes[input.DeviceID] = code
	store.pairs[code] = pairing{DeviceID: input.DeviceID, ExpiresAt: expiration}
	respondJSON(w, pairingResponse{Code: code, ExpiresAt: expiration})
}

func (store *Store) Exchange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input exchangeRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.DeviceID == "" || len(input.Code) != codeLength {
		http.Error(w, "invalid pairing request", http.StatusBadRequest)
		return
	}
	store.Lock()
	defer store.Unlock()
	entry, ok := store.pairs[input.Code]
	if !ok {
		http.Error(w, "pairing code expired or unavailable", http.StatusNotFound)
		return
	}
	if entry.DeviceID == input.DeviceID {
		http.Error(w, "cannot pair the same device", http.StatusBadRequest)
		return
	}
	respondJSON(w, exchangeResponse{PeerDeviceID: entry.DeviceID})
}

func (store *Store) Presence(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input struct {
		DeviceIDs []string `json:"deviceIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid presence request", http.StatusBadRequest)
		return
	}
	store.Lock()
	defer store.Unlock()
	devices := make([]devicePresence, 0, len(input.DeviceIDs))
	for _, deviceID := range input.DeviceIDs {
		trimmed := strings.TrimSpace(deviceID)
		if trimmed == "" {
			continue
		}
		devices = append(devices, devicePresence{DeviceID: trimmed, Online: store.clients[trimmed] != nil})
	}
	respondJSON(w, presenceResponse{Devices: devices})
}

func (store *Store) LanDevices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input lanDevicesRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.DeviceID) == "" {
		http.Error(w, "deviceId is required", http.StatusBadRequest)
		return
	}
	networkID := requestNetworkID(r)
	if networkID == "" {
		respondJSON(w, lanDevicesResponse{Devices: []lanDevice{}})
		return
	}
	store.Lock()
	devices := store.lanDevicesLocked(networkID, input.DeviceID)
	store.Unlock()
	respondJSON(w, lanDevicesResponse{Devices: devices})
}

func (store *Store) lanDevicesLocked(networkID string, excludedDeviceID string) []lanDevice {
	devices := make([]lanDevice, 0)
	for deviceID, client := range store.clients {
		if deviceID == excludedDeviceID || client.networkID != networkID {
			continue
		}
		devices = append(devices, lanDevice{DeviceID: deviceID, Nickname: client.profile.Nickname, Avatar: client.profile.Avatar, Online: true})
	}
	sort.Slice(devices, func(left int, right int) bool {
		if devices[left].Nickname == devices[right].Nickname {
			return devices[left].DeviceID < devices[right].DeviceID
		}
		return devices[left].Nickname < devices[right].Nickname
	})
	return devices
}

func requestNetworkID(r *http.Request) string {
	for _, value := range []string{r.Header.Get("X-Forwarded-For"), r.Header.Get("X-Real-IP")} {
		candidate := strings.TrimSpace(strings.Split(value, ",")[0])
		if ip := net.ParseIP(candidate); isUsableNetworkIP(ip) {
			return ip.String()
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return ""
	}
	ip := net.ParseIP(host)
	if !isUsableNetworkIP(ip) {
		return ""
	}
	return ip.String()
}

func isUsableNetworkIP(ip net.IP) bool {
	return ip != nil && !ip.IsLoopback() && !ip.IsUnspecified()
}

func respondJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}

func (store *Store) newCode() string {
	for {
		randomBytes := make([]byte, codeLength)
		_, _ = rand.Read(randomBytes)
		code := ""
		for _, randomByte := range randomBytes {
			code += fmt.Sprintf("%d", int(randomByte)%10)
		}
		if _, exists := store.pairs[code]; !exists {
			return code
		}
	}
}
