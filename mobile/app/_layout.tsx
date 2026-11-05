import "react-native-gesture-handler";
import {Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AuthProvider} from "../src/auth/AuthProvider";
import {CartProvider} from "../src/cart/CartProvider";
import {TryOnProvider} from "../src/tryon/TryOnProvider";

export default function RootLayout(){
  return <SafeAreaProvider><AuthProvider><CartProvider><TryOnProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:"#FFFFFF"}}}><Stack.Screen name="(tabs)"/><Stack.Screen name="welcome"/><Stack.Screen name="sign-in"/><Stack.Screen name="photo"/><Stack.Screen name="camera" options={{animation:"slide_from_bottom"}}/><Stack.Screen name="garments"/><Stack.Screen name="try-on/result"/><Stack.Screen name="product/[slug]"/><Stack.Screen name="search"/><Stack.Screen name="cart"/><Stack.Screen name="checkout"/><Stack.Screen name="orders"/><Stack.Screen name="settings"/><Stack.Screen name="notifications"/><Stack.Screen name="live" options={{animation:"fade"}}/></Stack></TryOnProvider></CartProvider></AuthProvider></SafeAreaProvider>;
}
