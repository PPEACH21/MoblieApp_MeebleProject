package config

import (
	"context"
	"log"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var App *firebase.App
var Ctx = context.Background()
var Auth *auth.Client
var DB *firestore.Client

func InitFirebase() {
	opt := option.WithCredentialsFile("./config/meeble-project-firebaseKey.json")

	app, err := firebase.NewApp(Ctx, nil, opt)
	if err != nil {
		log.Fatalf("error initializing firebase app: %v", err)
	}

	DB, err = app.Firestore(Ctx)
	if err != nil {
		log.Fatalf("error initializing firestore: %v", err)
	}
	Auth, err = app.Auth(Ctx)
	if err != nil {
		log.Fatalf("error initializing auth: %v", err)
	}
	log.Println(" Firebase initialized successfully")
}
