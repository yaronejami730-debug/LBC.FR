export type CarBrand = {
  name: string;
  logo: string;
};

// Logo URLs — source: clearbit CDN + manufacturer domains
export const CAR_BRANDS: CarBrand[] = [
  { name: "Abarth",        logo: "https://logo.clearbit.com/abarth.com" },
  { name: "Alfa Romeo",    logo: "https://logo.clearbit.com/alfaromeo.com" },
  { name: "Alpine",        logo: "https://logo.clearbit.com/alpinecars.com" },
  { name: "Aston Martin",  logo: "https://logo.clearbit.com/astonmartin.com" },
  { name: "Audi",          logo: "https://logo.clearbit.com/audi.com" },
  { name: "Bentley",       logo: "https://logo.clearbit.com/bentleymotors.com" },
  { name: "BMW",           logo: "https://logo.clearbit.com/bmw.com" },
  { name: "Bugatti",       logo: "https://logo.clearbit.com/bugatti.com" },
  { name: "Chevrolet",     logo: "https://logo.clearbit.com/chevrolet.com" },
  { name: "Citroën",       logo: "https://logo.clearbit.com/citroen.com" },
  { name: "Cupra",         logo: "https://logo.clearbit.com/cupraofficial.com" },
  { name: "Dacia",         logo: "https://logo.clearbit.com/dacia.fr" },
  { name: "DS",            logo: "https://logo.clearbit.com/dsautomobiles.com" },
  { name: "Ferrari",       logo: "https://logo.clearbit.com/ferrari.com" },
  { name: "Fiat",          logo: "https://logo.clearbit.com/fiat.com" },
  { name: "Ford",          logo: "https://logo.clearbit.com/ford.com" },
  { name: "Honda",         logo: "https://logo.clearbit.com/honda.com" },
  { name: "Hyundai",       logo: "https://logo.clearbit.com/hyundai.com" },
  { name: "Jaguar",        logo: "https://logo.clearbit.com/jaguar.com" },
  { name: "Jeep",          logo: "https://logo.clearbit.com/jeep.com" },
  { name: "Kia",           logo: "https://logo.clearbit.com/kia.com" },
  { name: "Lamborghini",   logo: "https://logo.clearbit.com/lamborghini.com" },
  { name: "Land Rover",    logo: "https://logo.clearbit.com/landrover.com" },
  { name: "Lexus",         logo: "https://logo.clearbit.com/lexus.com" },
  { name: "Maserati",      logo: "https://logo.clearbit.com/maserati.com" },
  { name: "Mazda",         logo: "https://logo.clearbit.com/mazda.com" },
  { name: "Mercedes-Benz", logo: "https://logo.clearbit.com/mercedes-benz.com" },
  { name: "Mini",          logo: "https://logo.clearbit.com/mini.com" },
  { name: "Mitsubishi",    logo: "https://logo.clearbit.com/mitsubishi-motors.com" },
  { name: "Nissan",        logo: "https://logo.clearbit.com/nissan.com" },
  { name: "Opel",          logo: "https://logo.clearbit.com/opel.com" },
  { name: "Peugeot",       logo: "https://logo.clearbit.com/peugeot.com" },
  { name: "Porsche",       logo: "https://logo.clearbit.com/porsche.com" },
  { name: "Renault",       logo: "https://logo.clearbit.com/renault.com" },
  { name: "Rolls-Royce",   logo: "https://logo.clearbit.com/rolls-roycemotorcars.com" },
  { name: "Seat",          logo: "https://logo.clearbit.com/seat.com" },
  { name: "Skoda",         logo: "https://logo.clearbit.com/skoda-auto.com" },
  { name: "Subaru",        logo: "https://logo.clearbit.com/subaru.com" },
  { name: "Suzuki",        logo: "https://logo.clearbit.com/suzuki.com" },
  { name: "Tesla",         logo: "https://logo.clearbit.com/tesla.com" },
  { name: "Toyota",        logo: "https://logo.clearbit.com/toyota.com" },
  { name: "Volkswagen",    logo: "https://logo.clearbit.com/vw.com" },
  { name: "Volvo",         logo: "https://logo.clearbit.com/volvocars.com" },
];

export function getBrandLogo(name: string): string | null {
  const brand = CAR_BRANDS.find(
    (b) => b.name.toLowerCase() === name.toLowerCase()
  );
  return brand?.logo ?? null;
}
