package httpapi

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
)

const (
	allowHeaders = "Content-Type, Authorization"
	allowMethods = "GET, POST, OPTIONS"
)

func respondJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", allowHeaders)
		w.Header().Set("Access-Control-Allow-Methods", allowMethods)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func requestHostname(r *http.Request, fallback string) string {
	forwardedHost := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if forwardedHost != "" {
		if host, _, err := net.SplitHostPort(forwardedHost); err == nil {
			return host
		}
		return forwardedHost
	}
	host := strings.TrimSpace(r.Host)
	if host == "" {
		return fallback
	}
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		return parsedHost
	}
	return host
}
