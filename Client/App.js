import { NavigationContainer } from '@react-navigation/native';
import StackNav from './src/StackNav.js';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/redux/store.js';

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaView style={{flex:1}}>
        <NavigationContainer>
          <StackNav/>
        </NavigationContainer>
      </SafeAreaView>
    </Provider>
  );
}