import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Geocodes an address asynchronously in the background.
   * Does not block - fires and forgets, updating the address when coordinates are found.
   */
  geocodeAddressAsync(addressId: string, zipCode: string): void {
    // Fire and forget - don't await
    this.processAddressGeocoding(addressId, zipCode).catch((error) => {
      this.logger.error(`Background geocoding failed for address ${addressId}:`, error);
    });
  }

  /**
   * Geocodes a restaurant address asynchronously in the background.
   * Does not block - fires and forgets, updating the restaurant when coordinates are found.
   */
  geocodeRestaurantAsync(restaurantId: string, zipCode: string): void {
    // Fire and forget - don't await
    this.processRestaurantGeocoding(restaurantId, zipCode).catch((error) => {
      this.logger.error(`Background geocoding failed for restaurant ${restaurantId}:`, error);
    });
  }

  private async processAddressGeocoding(addressId: string, zipCode: string): Promise<void> {
    const coordinates = await this.getCoordinatesFromCep(zipCode);

    if (coordinates) {
      await this.prisma.address.update({
        where: { id: addressId },
        data: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      });
      this.logger.log(
        `Geocoded address ${addressId}: ${coordinates.latitude}, ${coordinates.longitude}`,
      );
    } else {
      this.logger.warn(`Could not geocode address ${addressId} with CEP ${zipCode}`);
    }
  }

  private async processRestaurantGeocoding(restaurantId: string, zipCode: string): Promise<void> {
    const coordinates = await this.getCoordinatesFromCep(zipCode);

    if (coordinates) {
      await this.prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      });
      this.logger.log(
        `Geocoded restaurant ${restaurantId}: ${coordinates.latitude}, ${coordinates.longitude}`,
      );
    } else {
      this.logger.warn(`Could not geocode restaurant ${restaurantId} with CEP ${zipCode}`);
    }
  }

  async getCoordinatesFromCep(zipCode: string): Promise<GeocodingResult | null> {
    try {
      // Clean CEP (remove dashes and spaces)
      const cleanCep = zipCode.replace(/\D/g, '');

      if (cleanCep.length !== 8) {
        this.logger.warn(`Invalid CEP format: ${zipCode}`);
        return null;
      }

      // First, get address details from ViaCEP
      const viaCepData = await this.fetchViaCep(cleanCep);
      if (!viaCepData) {
        return null;
      }

      // Then, geocode the address using Nominatim (OpenStreetMap)
      const coordinates = await this.geocodeAddress(viaCepData);
      return coordinates;
    } catch (error) {
      this.logger.error(`Error getting coordinates for CEP ${zipCode}:`, error);
      return null;
    }
  }

  private async fetchViaCep(cep: string): Promise<ViaCepResponse | null> {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

      if (!response.ok) {
        this.logger.warn(`ViaCEP returned status ${response.status} for CEP ${cep}`);
        return null;
      }

      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        this.logger.warn(`CEP not found: ${cep}`);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error(`Error fetching ViaCEP for ${cep}:`, error);
      return null;
    }
  }

  private async geocodeAddress(viaCepData: ViaCepResponse): Promise<GeocodingResult | null> {
    try {
      // Build search query for Nominatim
      const query = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;
      const encodedQuery = encodeURIComponent(query);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1&countrycodes=br`,
        {
          headers: {
            'User-Agent': 'ZeFood/1.0 (contact@zefood.app)',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Nominatim returned status ${response.status}`);
        return null;
      }

      const data: NominatimResponse[] = await response.json();

      if (data.length === 0) {
        // Fallback: try with just city and state
        return this.geocodeFallback(viaCepData);
      }

      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    } catch (error) {
      this.logger.error('Error geocoding address:', error);
      return null;
    }
  }

  private async geocodeFallback(viaCepData: ViaCepResponse): Promise<GeocodingResult | null> {
    try {
      // Try with just city and state
      const query = `${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;
      const encodedQuery = encodeURIComponent(query);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1&countrycodes=br`,
        {
          headers: {
            'User-Agent': 'ZeFood/1.0 (contact@zefood.app)',
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data: NominatimResponse[] = await response.json();

      if (data.length === 0) {
        this.logger.warn(
          `Could not geocode address for ${viaCepData.localidade}, ${viaCepData.uf}`,
        );
        return null;
      }

      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    } catch (error) {
      this.logger.error('Error in geocode fallback:', error);
      return null;
    }
  }
}
