import { Text, View, TouchableOpacity, TextInput } from "react-native";
import { useEffect, useState } from "react";
import { TEXTinput } from "../components/TextInput";
import Animated, {
useSharedValue,
useAnimatedStyle,
withDelay,
withSequence,
withTiming,
Easing,cubicBezier 
} from "react-native-reanimated";
import { Layout } from "../components/Layout";
import { BaseColor as c } from "../components/Color";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn } from "../components/Button";

const Splash = ({ navigation }) => {
const yOpen = useSharedValue(0);
const xOpen = useSharedValue(0);
const scOpen = useSharedValue(20);
const bounceAndSlide = () => {
    xOpen.value = -200;
    yOpen.value = -400;
    scOpen.value = 1;
    yRegister.value = 800;
    opacityOpen.value = 0;
    setIsToggled(false);
    setlogin(false);
    setRegister(false);

    yOpen.value = withSequence(
    withDelay(500, withTiming(-400)),
    withTiming(0, {
        duration: 1000,
        easing: Easing.bounce,
    })
    );

    xOpen.value = withSequence(
    withDelay(500, withTiming(-200)),
    withTiming(0, {
        duration: 1200,
        easing: Easing.out(Easing.exp),
    })
    );

    scOpen.value = withSequence(
    withDelay(1400, withTiming(1)),
    withTiming(20, {
        duration: 1000,
        easing: Easing.inOut(Easing.circle),
    })
    );
};
const animatedOpen = useAnimatedStyle(() => {
    return {
    transform: [
        { translateX: xOpen.value },
        { translateY: yOpen.value },
        { scale: scOpen.value },
    ],
    };
});

const opacityOpen = useSharedValue(1);
const WelcomeSlice = () => {
    opacityOpen.value = withSequence(
    withDelay(1800, withTiming(0)),
    withTiming(1, { duration: 1000 })
    );
};
const animatedWelcome = useAnimatedStyle(() => {
    return {
    opacity: opacityOpen.value,
    };
});

const yOpenmove = useSharedValue(0);
const Openmove = useAnimatedStyle(() => ({
    transform: [
    {
        translateY: withTiming(yOpenmove.value, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    },
    ],
}));

const [login, setlogin] = useState(false);
const yLogin = useSharedValue(0);
const yLoginHead = useSharedValue(0);
const LoginTrigger = useAnimatedStyle(() => ({
    transform: [
    {
        translateY: withTiming(yLogin.value, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    },
    ],
}));
const LoginTriggerHead = useAnimatedStyle(() => ({
    transform: [
    {
        translateY: withTiming((yLoginHead.value)*yLogin.value, {
        duration: 2000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    },
    ],
}));

const [register, setRegister] = useState(false);
const yRegister = useSharedValue(200);
const yRegisterHead = useSharedValue(200);
const RegisterTrigger = useAnimatedStyle(() => ({
    transform: [
    {
        translateY: withTiming(yRegister.value, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    },
    ],
}));
const RegisterTriggerHead = useAnimatedStyle(() => ({
    transform: [
    {
        translateY: withTiming(yRegisterHead.value*yRegister.value, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    },
    ],
}));

const [isToggled, setIsToggled] = useState(false);
const whitebar = useSharedValue(900);
const whiteslide = useAnimatedStyle(() => ({
    transform: [
    {
        translateY: withTiming(whitebar.value, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
    },
    ],
}));

const rotate = {
    from: {
        transform: [{ rotateZ: '0deg' }],
    },
    to: {
        transform: [{ rotateZ: '360deg' }],
    },
};


useEffect(() => {
    yOpenmove.value = isToggled ? 600 : 0;
}, [isToggled]);

useEffect(() => {
    whitebar.value = isToggled ? 150 : 700;
    yLogin.value = login ? 90 : 600;
    yLoginHead.value = login ? 0 : 2;
}, [login]);

useEffect(() => {
    whitebar.value = isToggled ? 100 : 900;
    yRegister.value = register ? 90 : 700;
    yRegisterHead.value = register ?  0 : 2;
}, [register]);

useEffect(() => {
    bounceAndSlide();
    WelcomeSlice();
}, []);

return (
    <SafeAreaView style={[Layout.centerset, { backgroundColor: c.white }]}>
    <Animated.View
        style={[
        {
            position: "absolute",
            width: 50,
            height: 50,
            borderRadius: 40,
            backgroundColor: c.S1,
        },
        animatedOpen,
        ]}
    />

    <Animated.View style={[Layout.container, Layout.columset, animatedWelcome, Openmove]}>
        <Animated.View
            style={[
            {
                top:10,
                right:-100,
                width:200,
                height:200,
                borderRadius:10,
                position:"absolute",
                animationName: rotate,
                animationDuration: '5s',
                backgroundColor:c.S2,
                animationIterationCount: 'infinite',
                animationTimingFunction: cubicBezier(0.25, -0.5, 0.25, 1),
            },
            ]}
        />
        <Animated.View
            style={[
            {
                bottom:20,
                left:-100,
                width:300,
                height:300,
                borderRadius:10,
                position:"absolute",
                animationName: rotate,
                animationDuration: '7s',
                backgroundColor:c.S4,
                animationIterationCount: 'infinite',
                animationTimingFunction: cubicBezier(0.25, -0.5, 0.25, 1),
            },
            ]}
        />
        <View style={[{ flex: 1, justifyContent: "center" }]}>
        <Text
            style={{
            fontSize: 55,
            color: c.fullwhite,
            fontWeight: "bold",
            justifyContent: "flex-start",
            }}
        >
            MEEBLE
        </Text>
        <Text style={{ fontSize:16,color: c.fullwhite, fontWeight: "bold" }}>
            แอพสั่งอาหารสำหรับคุณ
        </Text>
        </View>

        <View style={[Layout.rowset, { flex: 1 }]}>
            <TouchableOpacity onPress={()=>{setRegister(true) ,setIsToggled(true),setlogin(false)}}style={[Btn.Btn2, { width: "40%" }]}>
                <Text style={Btn.textBtn2}>Register</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[Btn.Btn2, { width: "40%" }]}
                onPress={() => {
                setIsToggled(true);

                setlogin(!login);
                }}
            >
                <Text style={Btn.textBtn2}>Login</Text>
            </TouchableOpacity>
        </View>
    </Animated.View>
    
    <Animated.View style={[{ position: "absolute", top:100}, LoginTriggerHead]}>
        <Text style={{fontSize:60, fontWeight:'bold',color:c.fullwhite}}>LOGIN</Text>
    </Animated.View>
    <Animated.View style={[{ position: "absolute", top:100}, RegisterTriggerHead]}>
        <Text style={{fontSize:60, fontWeight:'bold',color:c.fullwhite}}>REGISTER</Text>
    </Animated.View>

    <Animated.View
        style={[
        {
            position: "absolute",
            width: "100%",
            height: "75%",
            borderTopRightRadius: 90,
            borderTopLeftRadius: 90,
            backgroundColor: c.white,
        },
        whiteslide,
        ]}
    />

    <Animated.View style={[{ position: "absolute",width:'80%'}, LoginTrigger]}>
        <View
        style={[
            Layout.centerset,
            { gap: 20, justifyContent: "space-between"},
        ]}
        >
        
        <View style={{width:'100%',gap:5}}>
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>username</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder="username" />
        </View>
        <View style={{width:'100%',gap:5}}>
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>password</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder="password" />
        </View>
        <Text style={{alignSelf:'flex-end'}}>ForgotPassword</Text>
        <TouchableOpacity
            style={[Btn.Btn1,{width:'100%'}]}
            onPress={() => {setlogin(false), setRegister(false), setIsToggled(false);}}
            >
            <Text style={{textAlign:'center'}}>SignIn</Text>
        </TouchableOpacity>
            <Text>You dont have user</Text>
        </View>
    </Animated.View>
    <Animated.View style={[{ position: "absolute",width:'80%' }, RegisterTrigger]}>
        <View
        style={[
            Layout.centerset,
            { gap: 13, justifyContent: "space-between"},
        ]}
        >
        <View style={{width:'100%',gap:5}}>    
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>Email</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder="email" />
        </View>
        <View style={{width:'100%',gap:5}}>
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>Username</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder="username" />
        </View>
        <View style={{width:'100%',gap:5}}>
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>Password</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder="password" />
        </View>
        <View style={{width:'100%',gap:5}}>
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>Confrim password</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder="confrim password" />
        </View>
        <TouchableOpacity
            style={[Btn.Btn1,{width:'100%'}]}
            onPress={() => {setlogin(false), setRegister(false), setIsToggled(false);}}
            >
            <Text style={{textAlign:'center'}}>SignIn</Text>
        </TouchableOpacity>
            <Text>You dont have user</Text>
        </View>
    </Animated.View>
    </SafeAreaView>
);
};
export default Splash;
