import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Splash from './mainpages/Splash';
import UserStack from './User/UserStack'
import V_ButtonNav from './Vendor/V_ButtonNav';
import VerifyOTP from './mainpages/VerifyOTP';
import CreateShop from './Vendor/pages/CreateShop';

const StackNav =()=>{    
    const Stack = createNativeStackNavigator()
    return(
        <Stack.Navigator initialRouteName='Splash' screenOptions={{headerShown:false}}>
            <Stack.Screen name='Splash' component={Splash}/>
            <Stack.Screen name='verifyotp' component={VerifyOTP}/>
            {/* <Stack.Screen name='Register' component={Register} options={{headerShown:true}}/>
            <Stack.Screen name='Recover' component={ForgotPassword} options={{headerShown:true}}/> */}
            <Stack.Screen name='CreateShop' component={CreateShop}/>
            <Stack.Screen name='HomeUser' component={UserStack}/>
            <Stack.Screen name='HomeVendor' component={V_ButtonNav}/>
        </Stack.Navigator>
    )
}

export default StackNav;