package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "Go on Pxxl", "path": r.URL.Path})
	})
	log.Printf("Go server listening on %s", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, nil))
}
