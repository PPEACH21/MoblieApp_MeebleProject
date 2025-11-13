// src/User/UserTabs.jsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { Text,View,Dimensions,TouchableOpacity} from "react-native";
import { useEffect } from "react";
import { Layout } from "../components/Layout";
import { BaseColor as c } from "../components/Color";
import U_Home from "./pages/U_Home";
import UserOrderScreen from "./pages/UserOrder";
import UserReserveScreen from "./pages/UserReservation";
import UserSettingScreen from "./pages/UserSetting";

import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing ,withSequence, useDerivedValue,} from 'react-native-reanimated';
const Tab = createBottomTabNavigator();
const TabStyle =({ state, descriptors, navigation }) => {
  const translateY = useSharedValue(300); 
  useEffect(() => {
    translateY.value = withTiming(0, { duration: 2000, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  
  const { width } = Dimensions.get("window");
  const TAB_COUNT = state.routes.length;
  const TAB_WIDTH = (width / TAB_COUNT)*0.65; // ระยะห่างแต่ละปุ่ม
  const indicatorX = useSharedValue(0); // เก็บตำแหน่งวงกลม
  const indicatorScale = useSharedValue(1);
  useEffect(() => {
    indicatorX.value = withTiming(state.index * TAB_WIDTH, { duration: 300 });
    indicatorScale.value = withSequence(
      withTiming(0.5, { duration: 200,easing: Easing.inOut(Easing.quad)}), 
      withTiming(1, { duration: 200,easing: Easing.inOut(Easing.quad)}) 
    );
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorX.value},
      { scale: indicatorScale.value },
    ],
  }));

  
  return (
    <Animated.View style={[Layout.rowset ,{
      position:'absolute',
      alignSelf:'center',
      backgroundColor:c.white, 
      padding:10,
      paddingVertical:20,
      borderRadius:40,
      bottom:15,
      gap:5,
      shadowColor:c.black,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 7,
    },animatedStyle
    ]}>

      <Animated.View style={[{position:'absolute',left:0,width:80,height:80,borderRadius:60,backgroundColor:c.S1},indicatorStyle]}/>

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const scale = useSharedValue(isFocused ? 1.3 : 1.0);
        useDerivedValue(() => {
          scale.value = withTiming(isFocused ? 1.3 : 1.0, {
            duration: 250,
          });
        }, [isFocused]);

        const animatedIconStyle = useAnimatedStyle(() => ({
          transform: [{ scale: scale.value }],
        }));

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }

          scale.value = withTiming(1.5, { duration: 100 }, () => {
            scale.value = withTiming(1.0, { duration: 200 });
          });
        
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        let iconName = "home-outline";
        if (route.name === "Home")iconName = isFocused ? "home-outline" : "home-outline";
        else if (route.name === "Orders")iconName = isFocused ? "receipt-outline" : "receipt-outline";
        // else if (route.name === "Reservations")iconName = isFocused ? "calendar-outline" : "calendar-outline";
        else if (route.name === "Settings")iconName = isFocused ? "settings-outline" : "settings-outline";

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{justifyContent:'center',alignItems:'center'}}
          >
            <Animated.View style={[animatedIconStyle,{alignItems:'center', width:55}]}>
              <Ionicons name={iconName} size={24} color={isFocused ? c.white : c.black} />
              <Text style={{ color: isFocused ? c.white : c.black , fontWeight: "700", fontSize: 10 }}>
                {label}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};


export default function U_ButtonNav({ initialRouteName = "Home" }) {
  return (
     <Tab.Navigator
      initialRouteName={String(initialRouteName || "Home")}
      tabBar={(props)=><TabStyle {...props}/>}
      screenOptions={{
        headerShown:false
      }}
    >
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

      {/* <Tab.Screen
        name="Reservations"
        component={UserReserveScreen}
        options={{ title: "การจอง" }}
      /> */}

      <Tab.Screen
        name="Settings"
        component={UserSettingScreen}
        options={{ title: "ตั้งค่า" }}
      />
    </Tab.Navigator>
  );
}
