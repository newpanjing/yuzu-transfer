package main

import (
	"fmt"
	"log"
	"net/http"

	"yuzu-transfer/internal/config"
	"yuzu-transfer/internal/httpapi"
	"yuzu-transfer/internal/store"
	"yuzu-transfer/internal/turnservice"
)

func main() {
	appConfig, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if err := turnservice.Start(appConfig.Turn); err != nil {
		log.Fatal(err)
	}
	dataStore := store.New()
	server := httpapi.New(appConfig, dataStore)
	address := fmt.Sprintf(":%d", appConfig.AppPort)
	log.Printf("Yuzu pairing service listening on %s", address)
	log.Fatal(http.ListenAndServe(address, server.Mux()))
}
