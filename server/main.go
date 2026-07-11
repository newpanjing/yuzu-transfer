package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	apiPrefix        = "/api/"
	codeLength       = 4
	codeLifetime     = 3 * time.Minute
	relayMaxFileSize = 20 * 1024 * 1024
)

type pairing struct {
	DeviceID  string    `json:"deviceId"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type pairingResponse struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type exchangeRequest struct {
	Code     string `json:"code"`
	DeviceID string `json:"deviceId"`
}
type exchangeResponse struct {
	PeerDeviceID string `json:"peerDeviceId"`
}
type store struct {
	sync.Mutex
	pairs   map[string]pairing
	clients map[string]*websocket.Conn
}

type signalMessage struct {
	To      string          `json:"to"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

var wsUpgrader = websocket.Upgrader{CheckOrigin: func(_ *http.Request) bool { return true }}

func main() {
	data := &store{pairs: make(map[string]pairing), clients: make(map[string]*websocket.Conn)}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/config", cors(func(w http.ResponseWriter, r *http.Request) {
		respond(w, map[string]int64{"relayMaxFileSize": relayMaxFileSize})
	}))
	mux.HandleFunc("/api/pairings", cors(data.createPairing))
	mux.HandleFunc("/api/pairings/exchange", cors(data.exchange))
	mux.HandleFunc("/api/signaling", data.signal)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	log.Println("Yuzu pairing service listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

func (s *store) signal(w http.ResponseWriter, r *http.Request) {
	deviceID := r.URL.Query().Get("deviceId")
	if deviceID == "" {
		http.Error(w, "deviceId is required", http.StatusBadRequest)
		return
	}
	connection, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	s.Lock()
	if previous := s.clients[deviceID]; previous != nil {
		_ = previous.Close()
	}
	s.clients[deviceID] = connection
	s.Unlock()
	defer func() {
		s.Lock()
		if s.clients[deviceID] == connection {
			delete(s.clients, deviceID)
		}
		s.Unlock()
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
		s.Lock()
		target := s.clients[message.To]
		s.Unlock()
		if target != nil {
			_ = target.WriteJSON(map[string]any{"from": deviceID, "type": message.Type, "payload": message.Payload})
		}
	}
}

func (s *store) createPairing(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input struct {
		DeviceID string `json:"deviceId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.DeviceID) == "" {
		http.Error(w, "deviceId is required", http.StatusBadRequest)
		return
	}
	s.Lock()
	defer s.Unlock()
	now := time.Now()
	for code, entry := range s.pairs {
		if now.After(entry.ExpiresAt) {
			delete(s.pairs, code)
		}
	}
	code := s.newCode()
	expiration := now.Add(codeLifetime)
	s.pairs[code] = pairing{DeviceID: input.DeviceID, ExpiresAt: expiration}
	respond(w, pairingResponse{Code: code, ExpiresAt: expiration})
}

func (s *store) exchange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input exchangeRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.DeviceID == "" || len(input.Code) != codeLength {
		http.Error(w, "invalid pairing request", http.StatusBadRequest)
		return
	}
	s.Lock()
	defer s.Unlock()
	entry, ok := s.pairs[input.Code]
	if !ok || time.Now().After(entry.ExpiresAt) {
		http.Error(w, "pairing code expired or unavailable", http.StatusNotFound)
		return
	}
	delete(s.pairs, input.Code)
	if entry.DeviceID == input.DeviceID {
		http.Error(w, "cannot pair the same device", http.StatusBadRequest)
		return
	}
	respond(w, exchangeResponse{PeerDeviceID: entry.DeviceID})
}

func (s *store) newCode() string {
	for {
		bytes := make([]byte, codeLength)
		_, _ = rand.Read(bytes)
		code := ""
		for _, b := range bytes {
			code += fmt.Sprintf("%d", int(b)%10)
		}
		if _, exists := s.pairs[code]; !exists {
			return code
		}
	}
}
func respond(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}
func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}
