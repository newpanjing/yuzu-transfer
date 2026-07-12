package turnservice

import (
	"fmt"
	"log"
	"net"

	"github.com/pion/turn/v2"

	"yuzu-transfer/internal/config"
)

const (
	udpNetwork = "udp4"
	tcpNetwork = "tcp4"
)

func Start(turnConfig config.TurnConfig) error {
	udpListener, err := net.ListenPacket(udpNetwork, fmt.Sprintf(":%d", turnConfig.Port))
	if err != nil {
		return fmt.Errorf("start turn udp listener: %w", err)
	}
	tcpListener, err := net.Listen(tcpNetwork, fmt.Sprintf(":%d", turnConfig.Port))
	if err != nil {
		return fmt.Errorf("start turn tcp listener: %w", err)
	}
	authKey := turn.GenerateAuthKey(turnConfig.Username, turnConfig.Realm, turnConfig.Password)
	relayGenerator := &turn.RelayAddressGeneratorStatic{
		RelayAddress: net.ParseIP(turnConfig.PublicIP),
		Address:      turnConfig.BindHost,
	}
	_, err = turn.NewServer(turn.ServerConfig{
		Realm: turnConfig.Realm,
		AuthHandler: func(username, realm string, srcAddr net.Addr) ([]byte, bool) {
			if username != turnConfig.Username || realm != turnConfig.Realm {
				return nil, false
			}
			return authKey, true
		},
		PacketConnConfigs: []turn.PacketConnConfig{{
			PacketConn:            udpListener,
			RelayAddressGenerator: relayGenerator,
		}},
		ListenerConfigs: []turn.ListenerConfig{{
			Listener:              tcpListener,
			RelayAddressGenerator: relayGenerator,
		}},
	})
	if err != nil {
		return fmt.Errorf("start turn server: %w", err)
	}
	log.Printf("Yuzu TURN server listening on :%d and advertising %s", turnConfig.Port, turnConfig.PublicIP)
	return nil
}
