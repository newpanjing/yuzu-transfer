package httpapi

import (
	"net/http"

	"yuzu-transfer/internal/config"
	"yuzu-transfer/internal/store"
)

const (
	apiConfigPath     = "/api/config"
	apiPairingsPath   = "/api/pairings"
	apiExchangePath   = "/api/pairings/exchange"
	apiPresencePath   = "/api/presence"
	apiLanDevicesPath = "/api/lan-devices"
	apiSignalingPath  = "/api/signaling"
	healthPath        = "/health"
)

type Server struct {
	config config.Config
	store  *store.Store
}

type configResponse struct {
	RelayMaxFileSize int64              `json:"relayMaxFileSize"`
	IceServers       []config.IceServer `json:"iceServers"`
}

func New(appConfig config.Config, dataStore *store.Store) *Server {
	return &Server{config: appConfig, store: dataStore}
}

func (server *Server) Mux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc(apiConfigPath, cors(server.handleConfig))
	mux.HandleFunc(apiPairingsPath, cors(server.store.CreatePairing))
	mux.HandleFunc(apiExchangePath, cors(server.store.Exchange))
	mux.HandleFunc(apiPresencePath, cors(server.store.Presence))
	mux.HandleFunc(apiLanDevicesPath, cors(server.store.LanDevices))
	mux.HandleFunc(apiSignalingPath, server.store.Signal)
	mux.HandleFunc(healthPath, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	return mux
}

func (server *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	hostname := requestHostname(r, server.config.Turn.PublicIP)
	respondJSON(w, configResponse{
		RelayMaxFileSize: server.config.RelayMaxFileSize,
		IceServers:       server.config.IceServers(hostname),
	})
}
