import { m } from './paraglide/messages.js';
import { getLocale,setLocale } from './paraglide/runtime.js';
import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import StackNav from './src/StackNav.js';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/redux/store.js';
import { StyleSheet } from 'react-native';



export default function App() {
  const [language, setLaguage] = useState(getLocale());
  const toggleLanguage = () => {
    const newLang = language === "th" ? "en" : "th";
    setLocale(newLang);
    setLaguage(newLang);
  };

  return (
    <Provider store={store}>
      <SafeAreaView style={{flex:1}}>
        {/* <Text>Open up App.js to start working on your app!</Text>
        <Text>{m.HELLO()}</Text>
        <Button title="CHANGE LANGUAGE" onPress={toggleLanguage} /> */}
        {/* <StatusBar style="auto" /> */}
        <NavigationContainer>
          <StackNav/>
        </NavigationContainer>
      </SafeAreaView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
