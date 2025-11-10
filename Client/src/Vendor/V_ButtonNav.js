// src/Vendor/AppTabs.jsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";


import HomeShopScreen from "./pages/HomeShop";
import MenuShopScreen from "./pages/MenuShop";
import OrderShopScreen from "./pages/OrderShop";
import ReserveShopScreen from "./pages/ResevationShop";
import SettingShopScreen from "./pages/SettingShop";
import { BaseColor as c } from "../components/Color";

const Tab = createBottomTabNavigator();

export default function V_ButtonNav({ shopId, initialRouteName = "Home" }) {
  return (
    <Tab.Navigator
      initialRouteName={String(initialRouteName || "Home")}
      screenOptions={({ route }) => {
        const icon = (focused, size, color) => {
          let name = "home-outline";
          if (route.name === "Home") name = focused ? "home" : "home-outline";
          else if (route.name === "Orders") name = focused ? "receipt" : "receipt-outline";
          else if (route.name === "Menu") name = focused ? "restaurant" : "restaurant-outline";
          else if (route.name === "Reserve") name = focused ? "calendar" : "calendar-outline";
          else if (route.name === "Settings") name = focused ? "settings" : "settings-outline";
          return <Ionicons name={name} size={Number(size) || 22} color={color} />;
        };

        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontWeight: "700" },
          tabBarActiveTintColor: c.S2,          // ส้มหลัก
          tabBarInactiveTintColor: c.black,     // ไอคอน/ตัวหนังสือจางลงเอง
          tabBarStyle: {
            backgroundColor: c.fullwhite,       // พื้นหลังขาว
            borderTopColor: c.S3,               // เส้นขอบส้มอ่อน
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
        component={ReserveShopScreen}
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
