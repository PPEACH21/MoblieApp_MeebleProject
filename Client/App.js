import { useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { enableScreens } from "react-native-screens";
import { SafeAreaView } from "react-native-safe-area-context";

import AppTabs from "./src/Navigation/appTab.js";
import StackNav from "./src/StackNav.js";

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});


