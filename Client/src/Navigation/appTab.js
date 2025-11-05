// AppTabs.jsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

// ✅ path ให้ตรงของคุณ
import HomeShopScreen from "../Vendor/HomeShop";
import MenuShopScreen from "../Vendor/MenuShop";
import SettingShopScreen from "../Vendor/SettingShop";

const Tab = createBottomTabNavigator();

export default function AppTabs({ shopId, initialRouteName = "Home" }) {
  return (
    <Tab.Navigator
      initialRouteName={String(initialRouteName || "Home")}
      screenOptions={({ route }) => {
        // ✅ ประกาศฟังก์ชัน icon ก่อน return
        const icon = (focused, size, color) => {
          let name = "home-outline";
          if (route.name === "Home") name = focused ? "home" : "home-outline";
          else if (route.name === "Orders")
            name = focused ? "restaurant" : "restaurant-outline"; // ← ปลอดภัยกว่า "receipt"
          else if (route.name === "Settings")
            name = focused ? "settings" : "settings-outline";
          return <Ionicons name={name} size={Number(size) || 20} color={color} />;
        };

        // ✅ ต้อง return วัตถุออกไป
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: "#16a34a",   // สีตอนเลือก
          tabBarInactiveTintColor: "#9ca3af", // สีตอนยังไม่เลือก
          tabBarStyle: {
            backgroundColor: "#f9fafb",       // สีพื้นหลังของแท็บ
            borderTopColor: "#e5e7eb",         // สีเส้นขอบบน
            height: 60,
          },
          tabBarIcon: ({ focused, size, color }) => icon(focused, size, color),
          // (ถ้าอยากได้พื้นหลังแท็บที่ถูกเลือกด้วย)
          // tabBarActiveBackgroundColor: "#e8f5e9",
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
        component={MenuShopScreen}
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "เมนูในร้าน" }}
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
