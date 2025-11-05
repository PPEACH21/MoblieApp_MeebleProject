import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native';
// import {m} from './src/paraglide/messages.js'
// import { getLocale, setLocale } from './src/paraglide/runtime.js';
import { useState } from 'react';
import TestSend from './src/vendor/testSend';

export default function App() {

  // const [language,setLaguage] = useState(getLocale());
  // const toggleLanguage = () => {
  //   const newLang = language === "th" ? "en" : "th";
  //   setLocale(newLang);
  //   setLaguage(newLang);
  // };

  return (
    // <View style={styles.container}>
    //   <Text>Open up App.js to start working on your app!</Text>
    //   <Text>{m.login()}</Text>
    //   <Button title="CHANGE LANGUAGE" onPress={toggleLanguage} />
    //   <StatusBar style="auto" />
    // </View>
    <TestSend/>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
