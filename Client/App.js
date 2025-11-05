import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native';
import { getLocale,setLocale } from './paraglide/runtime.js';
import { m } from './paraglide/messages.js';
import { useState } from 'react';
import Login from './src/pages/Login.js';

export default function App() {

  const [language,setLaguage] = useState(getLocale());
  const toggleLanguage = () => {
    const newLang = language === "th" ? "en" : "th";
    setLocale(newLang);
    setLaguage(newLang);
  };

  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <Text>{m.HELLO()}</Text>
      <Button title="CHANGE LANGUAGE" onPress={toggleLanguage} />

      <StatusBar style="auto" />
    </View>
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
