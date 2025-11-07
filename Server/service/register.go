package service

import (
	"fmt"
	"os"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func CreateUser(c *fiber.Ctx) error {
	user := new(models.User)
	if err := c.BodyParser(user) ; err!=nil{
        return  c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	if(user.Email=="" || user.Password=="" || user.Username ==""){
		return  c.Status(fiber.StatusBadRequest).SendString("Please fill in all required fields.")
	}

	_,err := config.User.Where("email","==",user.Email).Limit(1).Documents(config.Ctx).Next()
	if err == nil{
		return c.Status(fiber.StatusBadRequest).SendString("email has already")
	}

	_,err = config.User.Where("username","==",user.Username).Limit(1).Documents(config.Ctx).Next()
	if err == nil{
		return c.Status(fiber.StatusBadRequest).SendString("Username have been Already")
	}
	_,err = config.Vendor.Where("email","==",user.Email).Limit(1).Documents(config.Ctx).Next()
	if err == nil{
		return c.Status(fiber.StatusBadRequest).SendString("email has already")
	}

	_,err = config.Vendor.Where("username","==",user.Username).Limit(1).Documents(config.Ctx).Next()
	if err == nil{
		return c.Status(fiber.StatusBadRequest).SendString("Username have been Already")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Error hashing password")
	}
	user.Password = string(hashedPassword)
	
	var docRef *firestore.DocumentRef

	if(user.Role=="vendor"){
		docRef, _, err = config.Vendor.Add(config.Ctx,map[string]interface{}{
			"email":     user.Email,
			"firstname": "",
			"lastname": "",
			"username": 	user.Username,
			"password":   user.Password,
			"verified": false,
			"Cost": 0,
			"createdat": firestore.ServerTimestamp,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Error saving user")
		}
	}else{
		docRef, _, err = config.User.Add(config.Ctx,map[string]interface{}{
			"email":     user.Email,
			"firstname": "",
			"lastname": "",
			"username": 	user.Username,
			"password":   user.Password,
			"verified": false,
			"Cost": 0,
			"createdat": firestore.ServerTimestamp,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Error saving user")
		}
	}

	_, err = docRef.Update(config.Ctx, []firestore.Update{
		{Path: "id", Value: docRef.ID},
	})
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Failed to update ID field")
	}
	
	claims := jwt.MapClaims{
		"user_id":  docRef.ID,
		"username": user.Username,
		"verified": false,
		"role":     user.Role,
		"exp":      time.Now().Add(time.Minute * 60).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secret := os.Getenv("JWT_SECRET")
	t, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.SendStatus(fiber.StatusInternalServerError)
	}
	
	return c.JSON(fiber.Map{
		"user_id":	docRef.ID,
		"verified":  false,
		"role": 	user.Role,
		"token"	:	t,
		"message" : "Create success",
	})
}

func ChangePassword(c *fiber.Ctx)error{
	user := new(models.User)
	if err := c.BodyParser(user); err != nil {
    return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
        "error": "Invalid request body",
    })
	}
	// fmt.Println(user)
	
	data,err := config.User.Where("email","==",user.Email).Documents(config.Ctx).GetAll()
	if err!=nil{
		return c.Status(fiber.StatusBadGateway).SendString("Get data error")
	}
	
	if len(data) == 0 {
		return c.Status(fiber.StatusNotFound).SendString("not data")	
	}
	
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Error hashing password")
	}
	
	docRef := data[0].Ref
	_, err = docRef.Update(config.Ctx, []firestore.Update{
		{Path: "password", Value: string(hashedPassword)},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error updating password",
		})
	}
	
	fmt.Println("updating password Complete")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Password changed successfully",
	})
}