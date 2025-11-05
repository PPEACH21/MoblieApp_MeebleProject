import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Splash from './mainpages/Splash';
import Login from './mainpages/Login';
import ButtonNav from './User/ButtonNav'

const StackNav =()=>{    
    const Stack = createNativeStackNavigator()
    return(
        <Stack.Navigator initialRouteName='Splash' screenOptions={{headerShown:false}}>
            <Stack.Screen name='Splash' component={Splash}/>
            {/* <Stack.Screen name='Login' component={Login}/> */}
            {/* <Stack.Screen name='Register' component={Register} options={{headerShown:true}}/>
            <Stack.Screen name='Recover' component={ForgotPassword} options={{headerShown:true}}/> */}
            <Stack.Screen name='HomeUser' component={ButtonNav}/>
        </Stack.Navigator>
    )
}

export default StackNav;