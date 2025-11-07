import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Splash from './mainpages/Splash';
import U_ButtonNav from './User/U_ButtonNav'
import V_ButtonNav from './vendor/V_ButtonNav';
import VerifyOTP from './mainpages/VerifyOTP';

const StackNav =()=>{    
    const Stack = createNativeStackNavigator()
    return(
        <Stack.Navigator initialRouteName='Splash' screenOptions={{headerShown:false}}>
            <Stack.Screen name='Splash' component={Splash}/>
            <Stack.Screen name='verifyotp' component={VerifyOTP}/>
            {/* <Stack.Screen name='Login' component={Login}/> */}
            {/* <Stack.Screen name='Register' component={Register} options={{headerShown:true}}/>
            <Stack.Screen name='Recover' component={ForgotPassword} options={{headerShown:true}}/> */}
            <Stack.Screen name='HomeUser' component={U_ButtonNav}/>
            <Stack.Screen name='HomeVendor' component={V_ButtonNav}/>
        </Stack.Navigator>
    )
}

export default StackNav;