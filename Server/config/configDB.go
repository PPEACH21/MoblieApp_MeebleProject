package config

import (
	"context"
	"log"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go"
	"google.golang.org/api/option"
)

var Client *firestore.Client
var User *firestore.CollectionRef
var Shops *firestore.CollectionRef
var Vendor *firestore.CollectionRef
var OTP *firestore.CollectionRef
var Ctx = context.Background()

func InitFirebase(){
	opt := option.WithCredentialsFile("./config/meeble-project-firebaseKey.json")

	app, err := firebase.NewApp(Ctx, nil, opt)
	if err != nil {
		log.Fatalf("error initializing firebase app: %v", err)
	}

	Client, err = app.Firestore(Ctx)
	if err != nil {
		log.Fatalf("error initializing firestore: %v", err)
	}

	
	User = Client.Collection("users")
	Shops = Client.Collection("shops")
	Vendor = Client.Collection("vendors")
	OTP = Client.Collection("otp")
}

