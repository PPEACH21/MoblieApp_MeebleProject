// src/User/UserStack.jsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import U_ButtonNav from "./U_ButtonNav";              
import UserShopDetail from "./pages/UserShopDetail";     
import Cart from "./pages/UserCart";
import UserOrderDetail from "./pages/UserOrderDetail";
import UserHistoryDetail from "./pages/UserHistoryDetail";

const Stack = createNativeStackNavigator();

export default function UserStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="UserTabs"
        component={U_ButtonNav}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserShopDetail"
        component={UserShopDetail}
        options={{ headerShown: true, title: "รายละเอียดร้าน" }}
      />
      <Stack.Screen
        name="Cart"
        component={Cart}
        options={{ headerShown: true, title: "ตะกร้าสินค้า" }}
      />
      <Stack.Screen
        name="UserOrderDetail"
        component={UserOrderDetail}
        options={{ headerShown: true, title: "รายละเอียดออเดอร์" }}
      />
      <Stack.Screen
        name="UserHistoryDetail"
        component={UserHistoryDetail}
        options={{ headerShown: true, title: "รายละเอียดประวัติออเดอร์" }}
      />

    </Stack.Navigator>
    
  );
}
