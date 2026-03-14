import React, { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapViewWrapperProps {
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

export default function MapViewWrapper(props: MapViewWrapperProps) {
  const [MapComponent, setMapComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsLoading(false);
    } else {
      const loadMaps = async () => {
        try {
          const Maps = await import('react-native-maps');
          setMapComponent(() => Maps.default);
          setIsLoading(false);
        } catch (error) {
          console.error('Erro ao carregar maps:', error);
          setIsLoading(false);
        }
      };
      loadMaps();
    }
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: '#4B5563' }}>Carregando mapa...</Text>
      </View>
    );
  }

  // Versão para Web
  if (Platform.OS === 'web') {
    const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBvGd5WchRUg2FwNKpc9v4VFWHbjWxCjRA&q=${props.region.latitude},${props.region.longitude}`;
    
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
  if (!MapComponent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <Text>Mapa não disponível</Text>
      </View>
    );
  }

  return (
    <MapComponent
      style={{ flex: 1 }}
      region={props.region}
      showsUserLocation={props.showsUserLocation}
      showsMyLocationButton={props.showsMyLocationButton}
    >
      <MapComponent.Marker
        coordinate={{
          latitude: props.region.latitude,
          longitude: props.region.longitude,
        }}
        title={props.markerTitle}
        description={props.markerDescription}
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
      </MapComponent.Marker>
    </MapComponent>
  );
}