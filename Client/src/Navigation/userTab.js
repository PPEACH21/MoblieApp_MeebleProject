// src/User/UserTabs.jsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BaseColor } from "../components/Color";

// ✅ import หน้าหลักของ user
import U_Home from "./../User/pages/U_Home";
import UserOrderScreen from "./../User/pages/UserOrder";
import UserSettingScreen from "./../User/pages/UserSetting";

const Tab = createBottomTabNavigator();

export default function UserTabs({ initialRouteName = "Home" }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName={String(initialRouteName || "Home")}
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: BaseColor.S2 },
        headerTitleStyle: { color: BaseColor.fullwhite, fontWeight: "600" },
        headerTintColor: BaseColor.fullwhite,

        tabBarShowLabel: true,
        tabBarActiveTintColor: BaseColor.S2,
        tabBarInactiveTintColor: BaseColor.black,
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 0, // กัน label ดันจนไอคอนล้น
          fontWeight: "500",
        },
        tabBarStyle: {
          backgroundColor: BaseColor.fullwhite,
          borderTopWidth: 0.3,
          borderTopColor: BaseColor.S4,
          height: (Platform.OS === "ios" ? 58 : 56) + Math.max(insets.bottom, 6),
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
        },
        tabBarHideOnKeyboard: true,

        tabBarIcon: ({ focused, color }) => {
          let iconName = "home-outline";
          if (route.name === "Home")
            iconName = focused ? "home" : "home-outline";
          else if (route.name === "Orders")
            iconName = focused ? "receipt" : "receipt-outline";
          else if (route.name === "Reservations")
            iconName = focused ? "calendar" : "calendar-outline";
          else if (route.name === "Settings")
            iconName = focused ? "settings" : "settings-outline";

          return (
            <View
              style={{
                backgroundColor: focused ? BaseColor.S3 : "transparent",
                borderRadius: 12,
                padding: 6, // ลด padding กันล้น
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={iconName} size={15} color={color} />
            </View>
          );
        },
      })}
    >
      {/* ✅ หน้าแรก (Home) */}
      <Tab.Screen
        name="Home"
        component={U_Home}
        options={{ title: "หน้าแรก" }}
      />

      <Tab.Screen
        name="Orders"
        component={UserOrderScreen}
        options={{ title: "คำสั่งซื้อ" }}
      />

      <Tab.Screen
        name="Settings"
        component={UserSettingScreen}
        options={{ title: "ตั้งค่า" }}
      />
    </Tab.Navigator>
  );
}
