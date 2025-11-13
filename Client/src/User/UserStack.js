// src/User/UserStack.jsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import U_ButtonNav from "./U_ButtonNav";              
import UserShopDetail from "./pages/UserShopDetail";     
import Cart from "./pages/UserCart";
import UserOrderDetail from "./pages/UserOrderDetail";
import UserHistoryDetail from "./pages/UserHistoryDetail";
import { m } from "../paraglide/messages";
const Stack = createNativeStackNavigator();

export default function UserStack() {
  return (
    <Stack.Navigator
      screenOptions={{
     headerStyle: {                    // ลดความสูง
      backgroundColor: 'transparent',   // ทำให้โปร่งใส
      elevation: 0,                     // ตัด shadow Android
      shadowOpacity: 0,   
      height: 50,               // ควบคุมเอง
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      backgroundColor: '#fff',
      shadowColor: '#000',            // ตัด shadow iOS
    },
    headerTitleStyle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    headerTitleAlign: 'center',
  }}
    >
      <Stack.Screen
        name="UserTabs"
        component={U_ButtonNav}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserShopDetail"
        component={UserShopDetail}
        options={{ headerShown: true, title: m.shopdetail() }}
      />
      <Stack.Screen
        name="Cart"
        component={Cart}
        options={{ headerShown: true, title: m.cart() }}
      />
      <Stack.Screen
        name="UserOrderDetail"
        component={UserOrderDetail}
        options={{ headerShown: true, title: m.order_detail() }}
/>

      <Stack.Screen
        name="UserHistoryDetail"
        component={UserHistoryDetail}
        options={{ headerShown: true, title: m.order_detail()}}
      />

    </Stack.Navigator>
    
  );
}
