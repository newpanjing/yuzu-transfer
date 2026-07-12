package store

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	codeLength   = 4
	codeLifetime = 100 * 365 * 24 * time.Hour
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

type Store struct {
	sync.Mutex
	pairs       map[string]pairing
	deviceCodes map[string]string
	clients     map[string]*websocket.Conn
}

var upgrader = websocket.Upgrader{CheckOrigin: func(_ *http.Request) bool { return true }}

func New() *Store {
	return &Store{
		pairs:       make(map[string]pairing),
		deviceCodes: make(map[string]string),
		clients:     make(map[string]*websocket.Conn),
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
	store.Lock()
	if previousConnection := store.clients[deviceID]; previousConnection != nil {
		_ = previousConnection.Close()
	}
	store.clients[deviceID] = connection
	store.Unlock()
	defer func() {
		store.Lock()
		if store.clients[deviceID] == connection {
			delete(store.clients, deviceID)
		}
		store.Unlock()
		_ = connection.Close()
	}()

	for {
		var message signalMessage
		if err := connection.ReadJSON(&message); err != nil {
			return
		}
		if message.To == "" || message.Type == "" {
			continue
		}
		store.Lock()
		targetConnection := store.clients[message.To]
		store.Unlock()
		if targetConnection != nil {
			_ = targetConnection.WriteJSON(map[string]any{"from": deviceID, "type": message.Type, "payload": message.Payload})
		}
	}
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
