// AppTabs.jsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

// ✅ path ให้ตรงกับโปรเจกต์ของคุณ
import HomeShopScreen from "../Vendor/HomeShop";
import OrderShopScreen from "../Vendor/OrderShop";
import MenuShopScreen from "../Vendor/MenuShop";
import SettingShopScreen from "../Vendor/SettingShop";
import ReserveShopScreen from "../Vendor/ResevationShop"; 

const Tab = createBottomTabNavigator();

export default function AppTabs({ shopId, initialRouteName = "Home" }) {
  return (
    <Tab.Navigator
      initialRouteName={String(initialRouteName || "Home")}
      screenOptions={({ route }) => {
        const icon = (focused, size, color) => {
          let name = "home-outline";
          if (route.name === "Home") name = focused ? "home" : "home-outline";
          else if (route.name === "Orders") name = focused ? "receipt" : "receipt-outline";
          else if (route.name === "Menu") name = focused ? "restaurant" : "restaurant-outline";
          else if (route.name === "Reserve") name = focused ? "calendar" : "calendar-outline"; // ✅ แท็บจอง
          else if (route.name === "Settings") name = focused ? "settings" : "settings-outline";
          return <Ionicons name={name} size={Number(size) || 22} color={color} />;
        };

        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: "#16a34a",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: {
            backgroundColor: "#f9fafb",
            borderTopColor: "#e5e7eb",
            height: 60,
          },
          tabBarIcon: ({ focused, size, color }) => icon(focused, size, color),
        };
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeShopScreen}
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "หน้าร้าน" }}
      />

      <Tab.Screen
        name="Orders"
        component={OrderShopScreen}
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "ออเดอร์ร้าน" }}
      />

      <Tab.Screen
        name="Menu"
        component={MenuShopScreen}
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "เมนูในร้าน" }}
      />

      <Tab.Screen
        name="Reserve"
        component={ReserveShopScreen} // ✅ แท็บรายการจอง
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "การจอง" }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingShopScreen}
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "ตั้งค่า" }}
      />
    </Tab.Navigator>
  );
}
