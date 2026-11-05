import {Feather} from "@expo/vector-icons";
import {router} from "expo-router";
import {useEffect, useState} from "react";
import {ActivityIndicator, ImageBackground, Pressable, ScrollView, Text, View} from "react-native";
import {Api, type Product} from "../../src/api";
import {useAuth} from "../../src/auth/AuthProvider";
import {Button, Caption, ProductCard, SectionTitle} from "../../src/components/ui";
import {theme} from "../../src/theme";

const styleCards = [
  {label: "Everyday", image: require("../../assets/figma/home-everyday.png")},
  {label: "Chic", image: require("../../assets/figma/home-chic.png")},
  {label: "Casual", image: require("../../assets/figma/home-casual.png")},
  {label: "Street", image: require("../../assets/figma/home-street.png")},
] as const;
const filters = ["Trending", "Casual", "Summer"];

export default function Home() {
  const {user} = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [forYou, setForYou] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Trending");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([
      Api.products("?trending=true&limit=8"),
      Api.products("?featured=true&limit=4"),
    ]).then(([trending, featured]) => {
      if (!live) return;
      setItems(trending.products || []);
      setForYou(featured.products || []);
      setError("");
    }).catch((e: Error) => {
      if (live) setError(e.message);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const selected = category === "Trending"
    ? items
    : items.filter(product => (product.category || "").toLowerCase().includes(category.toLowerCase())).slice(0, 8);
  const openProduct = (product: Product) => router.push({pathname: "/product/[slug]", params: {slug: product.slug}});

  return <ScrollView style={{flex: 1, backgroundColor: theme.color.paper}} contentContainerStyle={{paddingBottom: 28}} showsVerticalScrollIndicator={false}>
    <View style={{paddingTop: 12, paddingHorizontal: 24}}>
      <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
        <View>
          <Caption>Hey, {user?.name?.split(" ")[0] || "there"} 👋</Caption>
          <Text style={{fontSize: 29, fontWeight: "700", color: theme.color.ink, marginTop: 3}}>Find your next look</Text>
        </View>
        <Pressable onPress={() => router.push("/notifications")} accessibilityLabel="Notifications" accessibilityRole="button">
          <Feather name="bell" size={21} color={theme.color.ink}/>
        </Pressable>
      </View>
      <Pressable onPress={() => router.push("/search")} accessibilityRole="search" style={{height: 48, borderBottomWidth: 1, borderBottomColor: theme.color.line, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 17}}>
        <Feather name="search" size={18} color={theme.color.muted}/>
        <Text style={{color: theme.color.muted, fontSize: 14}}>Search outfits, brands and more</Text>
      </Pressable>
    </View>

    <View style={{marginHorizontal: 24, marginTop: 16, backgroundColor: theme.color.ink, padding: 20, borderRadius: 2}}>
      <Text style={{color: "white", fontSize: 23, fontWeight: "700"}}>Your style, in real time.</Text>
      <Text style={{color: "#B9C3BF", fontSize: 13, lineHeight: 19, marginTop: 7}}>Explore a new look with Raritone.</Text>
      <Button title="Start Photo Try-on" onPress={() => router.push("/photo")} style={{backgroundColor: theme.color.pale, marginTop: 16, minHeight: 46}}/>
    </View>

    <View style={{marginTop: 19}}>
      <View style={{paddingHorizontal: 24}}><SectionTitle title="Discover" action="See all" onAction={() => router.push("/search")}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 24, gap: 22, marginTop: 6}}>
        {filters.map(filter => <Pressable key={filter} onPress={() => setCategory(filter)} accessibilityRole="tab" accessibilityState={{selected: category === filter}} style={{paddingVertical: 11, borderBottomWidth: 2, borderColor: category === filter ? theme.color.teal : "transparent", minWidth: 88, alignItems: "center"}}>
          <Text style={{fontSize: 13, color: category === filter ? theme.color.teal : theme.color.muted}}>{filter}</Text>
        </Pressable>)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 24, gap: 10, marginTop: 12}}>
        {styleCards.map(card => <Pressable key={card.label} onPress={() => router.push({pathname: "/search", params: {q: card.label}})} accessibilityRole="button" accessibilityLabel={`Explore ${card.label} style`}>
          <ImageBackground source={card.image} resizeMode="cover" style={{width: 138, height: 164, overflow: "hidden", justifyContent: "flex-end"}} imageStyle={{borderRadius: 8}}>
            <View style={{backgroundColor: "rgba(16,19,19,0.26)", paddingHorizontal: 12, paddingVertical: 13}}>
              <Text style={{color: "#FFFFFF", fontSize: 16, fontWeight: "700"}}>{card.label}</Text>
              <Text style={{color: "#FFFFFF", fontSize: 11, marginTop: 2}}>Explore style</Text>
            </View>
          </ImageBackground>
        </Pressable>)}
      </ScrollView>
    </View>

    <View style={{marginTop: 22}}>
      <View style={{paddingHorizontal: 24}}><SectionTitle title={category === "Trending" ? "Trending pieces" : `${category} pieces`} action="Shop all" onAction={() => router.push("/search")}/></View>
      {loading ? <ActivityIndicator style={{margin: 26}} color={theme.color.teal}/> : error ? <View style={{paddingHorizontal: 24, paddingTop: 20}}><Caption>{error}</Caption><Button title="Retry" variant="secondary" onPress={() => router.replace("/(tabs)")}/></View> : selected.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 24, gap: 12, marginTop: 13}}>
        {selected.map(product => <View key={product.id} style={{width: 138}}><ProductCard product={product} onPress={() => openProduct(product)} compact/><Caption numberOfLines={1} style={{marginTop: 5}}>{product.name}</Caption></View>)}
      </ScrollView> : <View style={{paddingHorizontal: 24, paddingTop: 18}}><Caption>No products match this filter yet.</Caption></View>}
    </View>

    <View style={{paddingHorizontal: 24, marginTop: 22}}>
      <SectionTitle title="Just for you" action="Shop all" onAction={() => router.push("/search")}/>
      {loading ? <ActivityIndicator style={{margin: 24}} color={theme.color.teal}/> : forYou.length ? <View style={{flexDirection: "row", gap: 12, marginTop: 12}}>{forYou.slice(0, 2).map(product => <ProductCard key={product.id} product={product} onPress={() => openProduct(product)}/>)}</View> : <Caption style={{marginTop: 10}}>New picks will appear here as your catalog loads.</Caption>}
    </View>
  </ScrollView>;
}
