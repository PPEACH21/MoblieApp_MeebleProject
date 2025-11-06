import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import U_Home from './pages/U_Home';


const U_ButtonNav =()=> {
  const Tab = createBottomTabNavigator();
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={U_Home} options={{headerShown:false}} />
    </Tab.Navigator>
  );
}

export default U_ButtonNav;