import { Image, Text, View } from "react-native"
import Animated from 'react-native-reanimated';
import { Layout } from "../components/Layout";
import { BlurView } from "expo-blur";


const Loading =()=>{
    const pulse = {
        from: {
            transform: [{ scale: 0.8 }, { rotateZ: '-15deg' }],
        },
        to: {
            transform: [{ scale: 1.2 }, { rotateZ: '15deg' }],
        },
    };

    return(
            <View style={[Layout.centerset,{position:'absolute',width:'100%',height:'100%'}]}>
            <BlurView
                intensity={80} 
                tint="light" 
                style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0, 0, 0, 0.38)", 
                }}
            />
            <Animated.View
                
                style={[
                {
                    animationName: pulse,
                    animationDuration: '1s',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-in-out',
                    animationDirection: 'alternate',
                },
                ]}
            >
                <Image
                    source={require("./../../assets/LOGO.jpg")}
                    style={{ width: 100, height: 100, resizeMode: "contain",borderRadius:10, }}
                />

            </Animated.View>
                    
        
        </View>
    )
}

export default Loading