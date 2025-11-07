package services

import (
	"context"
	"errors"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
)

func asFloat(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int64:
		return float64(x), true
	case int:
		return float64(x), true
	default:
		return 0, false
	}
}

func getMinMaxWithIndex(ctx context.Context, shopId string) (min *float64, max *float64, count int, err error) {
	col := config.Client.Collection(models.ColShops).Doc(shopId).Collection(models.SubColMenu)

	minSnap, err := col.Where("active", "==", true).OrderBy("price", firestore.Asc).Limit(1).Documents(ctx).GetAll()
	if err != nil {
		return nil, nil, 0, err
	}
	maxSnap, err := col.Where("active", "==", true).OrderBy("price", firestore.Desc).Limit(1).Documents(ctx).GetAll()
	if err != nil {
		return nil, nil, 0, err
	}
	allSnap, err := col.Where("active", "==", true).Documents(ctx).GetAll()
	if err != nil {
		return nil, nil, 0, err
	}
	count = len(allSnap)

	if len(minSnap) == 0 || len(maxSnap) == 0 {
		return nil, nil, count, nil
	}
	minV, ok1 := asFloat(minSnap[0].Data()["price"])
	maxV, ok2 := asFloat(maxSnap[0].Data()["price"])
	if !ok1 || !ok2 {
		return nil, nil, 0, errors.New("invalid price type")
	}
	return &minV, &maxV, count, nil
}

func getMinMaxByScan(ctx context.Context, shopId string) (min *float64, max *float64, count int, err error) {
	col := config.Client.Collection(models.ColShops).Doc(shopId).Collection(models.SubColMenu)
	snaps, err := col.Where("active", "==", true).Documents(ctx).GetAll()
	if err != nil {
		return nil, nil, 0, err
	}
	count = len(snaps)
	if count == 0 {
		return nil, nil, 0, nil
	}
	for _, s := range snaps {
		p, ok := asFloat(s.Data()["price"])
		if !ok {
			continue
		}
		if min == nil || p < *min {
			pp := p
			min = &pp
		}
		if max == nil || p > *max {
			pp := p
			max = &pp
		}
	}
	return
}

func UpdateShopPriceRange(ctx context.Context, shopId string) error {
	min, max, count, err := getMinMaxWithIndex(ctx, shopId)
	if err != nil {
		// fallback หากไม่มี index ฯลฯ
		min, max, count, err = getMinMaxByScan(ctx, shopId)
		if err != nil {
			return err
		}
	}

	updates := []firestore.Update{
		{Path: "updatedAt", Value: time.Now()},
		{Path: "menu_active_count", Value: count},
	}
	if min == nil || max == nil {
		updates = append(updates,
			firestore.Update{Path: "price_min", Value: nil},
			firestore.Update{Path: "price_max", Value: nil},
		)
	} else {
		updates = append(updates,
			firestore.Update{Path: "price_min", Value: *min},
			firestore.Update{Path: "price_max", Value: *max},
		)
	}

	_, err = config.Client.Collection(models.ColShops).Doc(shopId).Update(ctx, updates)
	return err
}
