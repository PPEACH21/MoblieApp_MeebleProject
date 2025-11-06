import { useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { enableScreens } from "react-native-screens";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import AppTabs from "./src/Navigation/appTab.js";
import StackNav from "./src/StackNav.js";
import UserTabs from "./src/Navigation/userTab.js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import UserShopDetail from "./src/User/pages/UserShopDetail.js";

// i18n (Paraglide)
import { getLocale, setLocale } from "./paraglide/runtime.js";
import { m } from "./paraglide/messages.js";

export default function App() {
  const [language, setLaguage] = useState(getLocale());
  enableScreens(false);
  const toggleLanguage = () => {
    const newLang = language === "th" ? "en" : "th";
    setLocale(newLang);
    setLaguage(newLang);
  };
const Stack = createNativeStackNavigator();

  return (
    <View style={styles.container}>
      {/* <Text>Open up App.js to start working on your app!</Text>
    <Text>{m.HELLO()}</Text>
     <Button title="CHANGE LANGUAGE" onPress={toggleLanguage} />

     <StatusBar style="auto" />  */}
      {/* <CreateShopScreen/> */}
      <SafeAreaProvider>
        <NavigationContainer>
          {/* <Stack.Navigator>
            <Stack.Screen
              name="UserTabs"
              component={UserTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UserShopDetail"
              component={UserShopDetail}
              options={{ title: "รายละเอียดร้าน" }}
            />
          </Stack.Navigator> */}
          <AppTabs/>
        </NavigationContainer>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
