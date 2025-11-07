// src/Vendor/AppTabs.jsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import HomeShopScreen   from "../vendor/HomeShop";
import OrderShopScreen  from "../vendor/OrderShop";
import MenuShopScreen   from "../vendor/MenuShop";
import SettingShopScreen from "../vendor/SettingShop";

import { BaseColor as c } from "../components/Color";

const OrderStackNav = createNativeStackNavigator();
function OrdersStack({ route }) {
  const shopId = route?.params?.shopId ?? "";
  return (
    <OrderStackNav.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "800" },
      }}
    >
      <OrderStackNav.Screen
        name="OrderShop"
        component={OrderShopScreen}
        initialParams={{ shopId }}
        options={{ title: "ออเดอร์ร้าน" }}
      />
      <OrderStackNav.Screen
        name="OrderDetail"
        // ✅ ใช้ V ใหญ่ และมีไฟล์จริง
        getComponent={() => require("../vendor/OrderDetail").default}
        options={{ title: "รายละเอียดออเดอร์" }}
      />
    </OrderStackNav.Navigator>
  );
}

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
          else if (route.name === "Settings") name = focused ? "settings" : "settings-outline";
          return <Ionicons name={name} size={Number(size) || 22} color={color} />;
        };

        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontWeight: "700" },
          tabBarActiveTintColor: c.S2,
          tabBarInactiveTintColor: c.black,
          tabBarStyle: {
            backgroundColor: c.fullwhite,
            borderTopColor: c.S3,
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
        component={OrdersStack}
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
        name="Settings"
        component={SettingShopScreen}
        initialParams={{ shopId: String(shopId || "") }}
        options={{ title: "ตั้งค่า" }}
      />
    </Tab.Navigator>
  );
}
