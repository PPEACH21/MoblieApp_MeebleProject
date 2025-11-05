import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "react-native";
import { getLocale, setLocale } from "./paraglide/runtime.js";
import { m } from "./paraglide/messages.js";
import { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import HomeShop from "./src/Vendor/HomeShop.js";
import AppTabs from "./src/Navigation/appTab.js";
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native';
import { m } from './paraglide/messages.js';
import { getLocale,setLocale } from './paraglide/runtime.js';
import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import StackNav from './src/StackNav.js';
import { SafeAreaView } from 'react-native-safe-area-context';
import U_Home from './src/User/pages/U_Home.js';

export default function App() {
  const [language, setLaguage] = useState(getLocale());
  enableScreens(false);
  const toggleLanguage = () => {
    const newLang = language === "th" ? "en" : "th";
    setLocale(newLang);
    setLaguage(newLang);
  };

  return (
    
    <View style={styles.container}>
      {/* <Text>Open up App.js to start working on your app!</Text>
    <Text>{m.HELLO()}</Text>
     <Button title="CHANGE LANGUAGE" onPress={toggleLanguage} />

     <StatusBar style="auto" />  */}
      {/* <CreateShopScreen/> */}
      <NavigationContainer>
        <AppTabs shopId="qIcsHxOuL5uAtW4TwAeV" initialRouteName="Home" />
      </NavigationContainer>
    </View>
  );
}


