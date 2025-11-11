// src/User/UserStack.jsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import U_ButtonNav from "./U_ButtonNav";              
import UserShopDetail from "./pages/UserShopDetail";     

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
    </Stack.Navigator>
  );
}
