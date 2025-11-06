import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import V_Home from './pages/V_Home';


const V_ButtonNav =()=> {
  const Tab = createBottomTabNavigator();
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={V_Home} options={{headerShown:false}} />
    </Tab.Navigator>
  );
}

export default V_ButtonNav;