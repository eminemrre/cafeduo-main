import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapLocationPicker } from './MapLocationPicker';
import { searchAddresses } from '../../lib/geocoding';

jest.mock('../../lib/geocoding', () => ({
  searchAddresses: jest.fn(),
}));

const buildProps = () => ({
  primaryLatitude: '37.740000',
  primaryLongitude: '29.100000',
  primaryRadius: 150,
  secondaryLatitude: '37.750000',
  secondaryLongitude: '29.110000',
  secondaryRadius: 250,
  onPrimaryLatitudeChange: jest.fn(),
  onPrimaryLongitudeChange: jest.fn(),
  onPrimaryRadiusChange: jest.fn(),
  onSecondaryLatitudeChange: jest.fn(),
  onSecondaryLongitudeChange: jest.fn(),
  onSecondaryRadiusChange: jest.fn(),
});

describe('MapLocationPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches an address and writes the result to the active target', async () => {
    const props = buildProps();
    (searchAddresses as jest.Mock).mockResolvedValue([
      { placeId: '1', displayName: 'Kampüs Kafe', latitude: 37.741, longitude: 29.101 },
    ]);
    const user = userEvent.setup();

    render(<MapLocationPicker {...props} />);
    await user.type(screen.getByRole('searchbox', { name: 'Adres ara' }), 'kampüs');
    await user.click(screen.getByRole('button', { name: 'Adres ara' }));
    await user.click(await screen.findByRole('option', { name: 'Kampüs Kafe' }));

    expect(props.onPrimaryLatitudeChange).toHaveBeenCalledWith('37.741000');
    expect(props.onPrimaryLongitudeChange).toHaveBeenCalledWith('29.101000');
  });

  it('uses device coordinates and updates the selected secondary target', async () => {
    const props = buildProps();
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 37.742, longitude: 29.102 } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const user = userEvent.setup();

    render(<MapLocationPicker {...props} enableSecondary />);
    await user.click(screen.getByRole('button', { name: 'İkinci konum' }));
    await user.click(screen.getByRole('button', { name: 'Cihaz konumumu kullan' }));

    expect(props.onSecondaryLatitudeChange).toHaveBeenCalledWith('37.742000');
    expect(props.onSecondaryLongitudeChange).toHaveBeenCalledWith('29.102000');
  });

  it('emits the selected coordinate pair atomically when provided', async () => {
    const props = {
      ...buildProps(),
      onPrimaryCoordinatesChange: jest.fn(),
    };
    (searchAddresses as jest.Mock).mockResolvedValue([
      { placeId: '2', displayName: 'Yeni Kafe', latitude: 37.743, longitude: 29.103 },
    ]);
    const user = userEvent.setup();

    render(<MapLocationPicker {...props} />);
    await user.type(screen.getByRole('searchbox', { name: 'Adres ara' }), 'yeni');
    await user.click(screen.getByRole('button', { name: 'Adres ara' }));
    await user.click(await screen.findByRole('option', { name: 'Yeni Kafe' }));

    expect(props.onPrimaryCoordinatesChange).toHaveBeenCalledWith('37.743000', '29.103000');
    expect(props.onPrimaryLatitudeChange).not.toHaveBeenCalled();
    expect(props.onPrimaryLongitudeChange).not.toHaveBeenCalled();
  });

  it('synchronizes the radius slider and clears the active target', async () => {
    const props = buildProps();
    const user = userEvent.setup();

    render(<MapLocationPicker {...props} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Ana konum yarıçapı' }), {
      target: { value: '420' },
    });
    await user.click(screen.getByRole('button', { name: 'Ana konumu temizle' }));

    expect(props.onPrimaryRadiusChange).toHaveBeenCalledWith('420');
    expect(props.onPrimaryLatitudeChange).toHaveBeenCalledWith('');
    expect(props.onPrimaryLongitudeChange).toHaveBeenCalledWith('');
  });

  it('reports address search failures without changing the current coordinates', async () => {
    const props = buildProps();
    (searchAddresses as jest.Mock).mockRejectedValue(new Error('Adres servisi kapalı.'));
    const user = userEvent.setup();

    render(<MapLocationPicker {...props} />);
    await user.type(screen.getByRole('searchbox', { name: 'Adres ara' }), 'kampüs');
    await user.click(screen.getByRole('button', { name: 'Adres ara' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Adres servisi kapalı.')
    );
    expect(props.onPrimaryLatitudeChange).not.toHaveBeenCalled();
  });
});
