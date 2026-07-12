package config

import (
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
)

const (
	defaultAppPort        = 8080
	defaultTurnPort       = 3478
	defaultTurnRealm      = "yuzu-transfer"
	defaultTurnUsername   = "yuzu"
	defaultTurnPassword   = "yuzu-turn"
	defaultTurnBindHost   = "0.0.0.0"
	defaultRelayMaxSizeMB = 50 * 1024 * 1024
	udpNetwork            = "udp4"
)

type IceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

type TurnConfig struct {
	Port     int
	PublicIP string
	Realm    string
	Username string
	Password string
	BindHost string
}

type Config struct {
	AppPort          int
	RelayMaxFileSize int64
	Turn             TurnConfig
}

func Load() (Config, error) {
	publicIP := strings.TrimSpace(os.Getenv("TURN_PUBLIC_IP"))
	if publicIP == "" {
		detectedIP, err := detectIPv4()
		if err != nil {
			return Config{}, err
		}
		publicIP = detectedIP
	}
	return Config{
		AppPort:          envInt("APP_PORT", defaultAppPort),
		RelayMaxFileSize: defaultRelayMaxSizeMB,
		Turn: TurnConfig{
			Port:     envInt("TURN_PORT", defaultTurnPort),
			PublicIP: publicIP,
			Realm:    envString("TURN_REALM", defaultTurnRealm),
			Username: envString("TURN_USERNAME", defaultTurnUsername),
			Password: envString("TURN_PASSWORD", defaultTurnPassword),
			BindHost: envString("TURN_BIND_HOST", defaultTurnBindHost),
		},
	}, nil
}

func (config Config) IceServers(host string) []IceServer {
	return []IceServer{
		{URLs: []string{fmt.Sprintf("stun:%s:%d", host, config.Turn.Port)}},
		{
			URLs: []string{
				fmt.Sprintf("turn:%s:%d?transport=udp", host, config.Turn.Port),
				fmt.Sprintf("turn:%s:%d?transport=tcp", host, config.Turn.Port),
			},
			Username:   config.Turn.Username,
			Credential: config.Turn.Password,
		},
	}
}

func envString(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func detectIPv4() (string, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", fmt.Errorf("list interfaces: %w", err)
	}
	for _, networkInterface := range interfaces {
		if networkInterface.Flags&net.FlagUp == 0 || networkInterface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addresses, addressErr := networkInterface.Addrs()
		if addressErr != nil {
			continue
		}
		for _, address := range addresses {
			ipNet, ok := address.(*net.IPNet)
			if !ok || ipNet.IP == nil || ipNet.IP.IsLoopback() {
				continue
			}
			ipv4 := ipNet.IP.To4()
			if ipv4 == nil {
				continue
			}
			return ipv4.String(), nil
		}
	}
	return "", errors.New("detect TURN public IP failed; set TURN_PUBLIC_IP explicitly")
}
