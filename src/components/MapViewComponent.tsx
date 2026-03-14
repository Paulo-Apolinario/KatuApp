import React from 'react';
import { Platform, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import condicional para native
let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== 'web') {
  // Só importa react-native-maps em dispositivos nativos
  import('react-native-maps').then((Maps) => {
    MapView = Maps.default;
    Marker = Maps.Marker;
  });
}

interface MapViewComponentProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  markerTitle?: string;
  markerDescription?: string;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
}

export default function MapViewComponent({
  region,
  markerTitle,
  markerDescription,
  showsUserLocation = true,
  showsMyLocationButton = true,
}: MapViewComponentProps) {
  
  // Versão para Web - usa um iframe do Google Maps
  if (Platform.OS === 'web') {
    const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyAvYKYhPWh1vEqHdAzkoCgSObNMYHyNcX0&q=${region.latitude},${region.longitude}`;
    
    return (
      <View style={{ flex: 1, width: '100%', height: '100%' }}>
        <iframe
          src={googleMapsUrl}
          style={{ border: 0, width: '100%', height: '100%' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </View>
    );
  }

  // Versão para Native (iOS/Android)
  if (!MapView || !Marker) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
        <Text>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <MapView
      style={{ flex: 1 }}
      region={region}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
    >
      <Marker
        coordinate={{
          latitude: region.latitude,
          longitude: region.longitude,
        }}
        title={markerTitle}
        description={markerDescription}
      >
        <View style={{
          backgroundColor: "#028C56",
          padding: 8,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }}>
          <Ionicons name="business" size={20} color="#FFFFFF" />
        </View>
      </Marker>
    </MapView>
  );
}