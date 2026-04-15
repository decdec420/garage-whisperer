/**
 * Model-specific trim and engine options for popular vehicles.
 * Keyed by MAKE (uppercase) → MODEL (uppercase) → options[].
 * Falls back to empty array (renders text input) when no match.
 */

export const MODEL_TRIMS: Record<string, Record<string, string[]>> = {
  FORD: {
    'F-150': ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum', 'Limited', 'Raptor', 'Tremor', 'STX'],
    'MUSTANG': ['EcoBoost', 'EcoBoost Premium', 'GT', 'GT Premium', 'Mach 1', 'Shelby GT500', 'Dark Horse', 'Bullitt'],
    'EXPLORER': ['Base', 'XLT', 'Limited', 'ST', 'Platinum', 'Timberline', 'King Ranch'],
    'ESCAPE': ['S', 'SE', 'SEL', 'Titanium', 'PHEV', 'ST-Line'],
    'TRANSIT CONNECT': ['XL', 'XLT', 'Titanium'],
    'BRONCO': ['Base', 'Big Bend', 'Black Diamond', 'Outer Banks', 'Badlands', 'Wildtrak', 'Raptor', 'Heritage'],
    'BRONCO SPORT': ['Base', 'Big Bend', 'Outer Banks', 'Badlands', 'Heritage'],
    'MAVERICK': ['XL', 'XLT', 'Lariat', 'Tremor'],
    'EDGE': ['SE', 'SEL', 'Titanium', 'ST', 'ST-Line'],
    'RANGER': ['XL', 'XLT', 'Lariat', 'Raptor'],
    'EXPEDITION': ['XL STX', 'XLT', 'Limited', 'King Ranch', 'Platinum', 'Timberline'],
    'FUSION': ['S', 'SE', 'SEL', 'Titanium', 'Sport', 'Energi'],
    'FOCUS': ['S', 'SE', 'SEL', 'Titanium', 'ST', 'RS'],
  },
  TOYOTA: {
    'CAMRY': ['LE', 'SE', 'SE Nightshade', 'XLE', 'XSE', 'TRD'],
    'COROLLA': ['L', 'LE', 'SE', 'XLE', 'XSE', 'Hybrid LE', 'Hybrid SE'],
    'RAV4': ['LE', 'XLE', 'XLE Premium', 'Adventure', 'TRD Off-Road', 'Limited', 'SE Hybrid', 'XSE Hybrid', 'Prime SE', 'Prime XSE'],
    'TACOMA': ['SR', 'SR5', 'TRD Sport', 'TRD Off-Road', 'Limited', 'TRD Pro', 'Trail'],
    'TUNDRA': ['SR', 'SR5', 'Limited', 'Platinum', 'TRD Pro', '1794 Edition', 'Capstone'],
    '4RUNNER': ['SR5', 'SR5 Premium', 'TRD Sport', 'TRD Off-Road', 'TRD Off-Road Premium', 'Limited', 'TRD Pro'],
    'HIGHLANDER': ['L', 'LE', 'XLE', 'XSE', 'Limited', 'Platinum', 'Bronze Edition', 'Hybrid'],
    'PRIUS': ['LE', 'XLE', 'Limited', 'Nightshade', 'Prime'],
    'SUPRA': ['2.0', '3.0', '3.0 Premium', 'A91 Edition'],
    'COROLLA CROSS': ['L', 'LE', 'XLE', 'SE', 'Hybrid S', 'Hybrid SE', 'Hybrid XLE'],
    'GR86': ['Base', 'Premium'],
  },
  HONDA: {
    'CIVIC': ['LX', 'Sport', 'EX', 'Touring', 'Si', 'Type R'],
    'ACCORD': ['LX', 'EX', 'EX-L', 'Sport', 'Sport Hybrid', 'Touring', 'Touring Hybrid'],
    'CR-V': ['LX', 'EX', 'EX-L', 'Touring', 'Sport', 'Sport Touring', 'Hybrid Sport', 'Hybrid Sport-L', 'Hybrid EX-L', 'Hybrid Touring'],
    'PILOT': ['LX', 'Sport', 'EX-L', 'TrailSport', 'Touring', 'Elite', 'Black Edition'],
    'HR-V': ['LX', 'Sport', 'EX-L'],
    'ODYSSEY': ['LX', 'EX', 'EX-L', 'Touring', 'Elite'],
    'RIDGELINE': ['Sport', 'RTL', 'RTL-E', 'Black Edition', 'TrailSport'],
    'FIT': ['LX', 'Sport', 'EX', 'EX-L'],
  },
  CHEVROLET: {
    'SILVERADO 1500': ['WT', 'Custom', 'Custom Trail Boss', 'LT', 'RST', 'LT Trail Boss', 'LTZ', 'High Country', 'ZR2'],
    'SILVERADO': ['WT', 'Custom', 'Custom Trail Boss', 'LT', 'RST', 'LT Trail Boss', 'LTZ', 'High Country', 'ZR2'],
    'CAMARO': ['1LS', '1LT', '2LT', '3LT', '1SS', '2SS', 'ZL1', 'LT1'],
    'CORVETTE': ['1LT', '2LT', '3LT', '1LZ', '2LZ', '3LZ', 'Z06', 'E-Ray', 'ZR1'],
    'EQUINOX': ['LS', 'LT', 'RS', 'Premier', 'Activ'],
    'TAHOE': ['LS', 'LT', 'RST', 'Z71', 'Premier', 'High Country'],
    'COLORADO': ['WT', 'LT', 'Z71', 'Trail Boss', 'ZR2'],
    'MALIBU': ['LS', 'LT', 'RS', 'Premier'],
    'TRAVERSE': ['LS', 'LT', 'RS', 'Z71', 'Premier', 'High Country'],
    'SUBURBAN': ['LS', 'LT', 'RST', 'Z71', 'Premier', 'High Country'],
    'BLAZER': ['LT', 'RS', 'Premier'],
  },
  JEEP: {
    'WRANGLER': ['Sport', 'Sport S', 'Willys', 'Sahara', 'Rubicon', 'High Altitude', '392', '4xe'],
    'GRAND CHEROKEE': ['Laredo', 'Altitude', 'Limited', 'Overland', 'Trailhawk', 'Summit', 'Summit Reserve', '4xe'],
    'CHEROKEE': ['Latitude', 'Latitude Lux', 'Altitude', 'Trailhawk', 'Limited'],
    'GLADIATOR': ['Sport', 'Sport S', 'Willys', 'Overland', 'Rubicon', 'Mojave', 'High Altitude'],
    'COMPASS': ['Sport', 'Latitude', 'Latitude Lux', 'Limited', 'Trailhawk', 'High Altitude'],
    'RENEGADE': ['Sport', 'Latitude', 'Altitude', 'Limited', 'Trailhawk'],
    'GRAND WAGONEER': ['Series I', 'Series II', 'Series III', 'Obsidian'],
  },
  RAM: {
    '1500': ['Tradesman', 'Big Horn', 'Lone Star', 'Laramie', 'Rebel', 'Limited', 'TRX', 'Limited Longhorn', 'Limited Red Edition'],
    '2500': ['Tradesman', 'Big Horn', 'Laramie', 'Limited', 'Limited Longhorn', 'Power Wagon'],
    '3500': ['Tradesman', 'Big Horn', 'Laramie', 'Limited', 'Limited Longhorn'],
  },
  GMC: {
    'SIERRA 1500': ['Pro', 'SLE', 'SLT', 'AT4', 'AT4X', 'Denali', 'Denali Ultimate', 'Elevation'],
    'SIERRA': ['Pro', 'SLE', 'SLT', 'AT4', 'AT4X', 'Denali', 'Denali Ultimate', 'Elevation'],
    'YUKON': ['SLE', 'SLT', 'AT4', 'Denali', 'Denali Ultimate'],
    'CANYON': ['Elevation', 'AT4', 'AT4X', 'Denali'],
    'TERRAIN': ['SLE', 'SLT', 'AT4', 'Denali'],
    'ACADIA': ['SLE', 'SLT', 'AT4', 'Denali'],
  },
  HYUNDAI: {
    'TUCSON': ['SE', 'SEL', 'N Line', 'Limited', 'XRT', 'Hybrid Blue', 'Hybrid SEL', 'Hybrid Limited', 'PHEV'],
    'SANTA FE': ['SE', 'SEL', 'XRT', 'Limited', 'Calligraphy', 'Hybrid', 'PHEV'],
    'ELANTRA': ['SE', 'SEL', 'N Line', 'Limited', 'N'],
    'SONATA': ['SE', 'SEL', 'SEL Plus', 'Limited', 'N Line'],
    'PALISADE': ['SE', 'SEL', 'XRT', 'Limited', 'Calligraphy'],
    'KONA': ['SE', 'SEL', 'N Line', 'Limited', 'N'],
    'IONIQ 5': ['SE Standard Range', 'SE Long Range', 'SEL', 'Limited', 'N'],
    'IONIQ 6': ['SE Standard Range', 'SE Long Range', 'SEL', 'Limited'],
  },
  KIA: {
    'TELLURIDE': ['LX', 'S', 'EX', 'SX', 'SX Prestige', 'X-Line', 'X-Pro'],
    'SPORTAGE': ['LX', 'EX', 'SX', 'SX Prestige', 'X-Line', 'X-Pro', 'Hybrid', 'PHEV'],
    'FORTE': ['FE', 'LXS', 'GT-Line', 'GT'],
    'SORENTO': ['LX', 'S', 'EX', 'SX', 'SX Prestige', 'X-Line', 'Hybrid', 'PHEV'],
    'K5': ['LX', 'LXS', 'GT-Line', 'EX', 'GT'],
    'SOUL': ['LX', 'S', 'EX', 'Turbo'],
    'EV6': ['Light', 'Wind', 'GT-Line', 'GT'],
  },
  SUBARU: {
    'OUTBACK': ['Base', 'Premium', 'Onyx Edition', 'Limited', 'Touring', 'Wilderness', 'Onyx Edition XT', 'Limited XT', 'Touring XT'],
    'FORESTER': ['Base', 'Premium', 'Sport', 'Limited', 'Touring', 'Wilderness'],
    'CROSSTREK': ['Base', 'Premium', 'Sport', 'Limited', 'Wilderness'],
    'WRX': ['Base', 'Premium', 'Limited', 'GT'],
    'IMPREZA': ['Base', 'Sport', 'RS'],
    'LEGACY': ['Base', 'Premium', 'Sport', 'Limited', 'Touring XT'],
    'BRZ': ['Premium', 'Limited', 'tS'],
    'ASCENT': ['Base', 'Premium', 'Onyx Edition', 'Limited', 'Touring'],
  },
  NISSAN: {
    'ALTIMA': ['S', 'SV', 'SR', 'SL', 'Platinum', 'SR Midnight Edition'],
    'ROGUE': ['S', 'SV', 'SL', 'Platinum', 'Rock Creek'],
    'PATHFINDER': ['S', 'SV', 'SL', 'Platinum', 'Rock Creek'],
    'FRONTIER': ['S', 'SV', 'PRO-4X', 'PRO-X'],
    'SENTRA': ['S', 'SV', 'SR', 'SR Midnight Edition'],
    'KICKS': ['S', 'SV', 'SR'],
    'TITAN': ['S', 'SV', 'PRO-4X', 'SL', 'Platinum Reserve'],
    'MAXIMA': ['SV', 'SR', 'Platinum', '40th Anniversary Edition'],
    '370Z': ['Sport', 'Sport Touring', 'Nismo'],
    'Z': ['Sport', 'Performance', 'Nismo'],
  },
  BMW: {
    '3 SERIES': ['330i', '330i xDrive', 'M340i', 'M340i xDrive'],
    '5 SERIES': ['530i', '530i xDrive', '540i', '540i xDrive', 'M550i xDrive'],
    'X3': ['sDrive30i', 'xDrive30i', 'M40i', 'X3 M', 'X3 M Competition'],
    'X5': ['sDrive40i', 'xDrive40i', 'xDrive45e', 'M50i', 'X5 M', 'X5 M Competition'],
    'M3': ['Base', 'Competition', 'Competition xDrive', 'CS'],
    'M4': ['Base', 'Competition', 'Competition xDrive', 'CSL'],
  },
  'MERCEDES-BENZ': {
    'C-CLASS': ['C 300', 'C 300 4MATIC', 'AMG C 43', 'AMG C 63'],
    'E-CLASS': ['E 350', 'E 350 4MATIC', 'E 450', 'AMG E 53', 'AMG E 63 S'],
    'GLC': ['GLC 300', 'GLC 300 4MATIC', 'AMG GLC 43', 'AMG GLC 63'],
    'GLE': ['GLE 350', 'GLE 350 4MATIC', 'GLE 450', 'AMG GLE 53', 'AMG GLE 63 S'],
  },
  VOLKSWAGEN: {
    'JETTA': ['S', 'SE', 'SEL', 'SEL Premium', 'GLI S', 'GLI Autobahn'],
    'TIGUAN': ['S', 'SE', 'SE R-Line', 'SEL', 'SEL R-Line'],
    'ATLAS': ['S', 'SE', 'SE with Technology', 'SEL', 'SEL Premium', 'SEL Premium R-Line', 'Cross Sport'],
    'GOLF': ['S', 'SE', 'GTI S', 'GTI SE', 'GTI Autobahn', 'R'],
    'TAOS': ['S', 'SE', 'SEL'],
    'ID.4': ['Standard', 'S', 'S Plus', 'Pro', 'Pro S', 'Pro S Plus'],
  },
  MAZDA: {
    'CX-5': ['S', 'S Select', 'S Preferred', 'S Carbon Edition', 'S Premium', 'S Premium Plus', 'Turbo', 'Turbo Premium Plus'],
    'CX-50': ['S', 'S Select', 'S Preferred', 'S Premium', 'S Premium Plus', 'Turbo', 'Turbo Premium Plus', 'Meridian Edition'],
    'MAZDA3': ['S', 'S Select', 'S Preferred', 'S Carbon Edition', 'S Premium', 'Turbo', 'Turbo Premium Plus'],
    'CX-30': ['S', 'S Select', 'S Preferred', 'S Carbon Edition', 'S Premium', 'Turbo', 'Turbo Premium Plus'],
    'CX-90': ['S', 'S Select', 'S Preferred', 'S Premium', 'S Premium Plus', 'Turbo', 'Turbo S', 'Turbo Premium Plus', 'PHEV'],
    'MX-5 MIATA': ['Sport', 'Club', 'Grand Touring'],
  },
  DODGE: {
    'CHARGER': ['SXT', 'GT', 'R/T', 'Scat Pack', 'SRT Hellcat', 'SRT Hellcat Redeye', 'SRT Jailbreak'],
    'CHALLENGER': ['SXT', 'GT', 'R/T', 'R/T Scat Pack', 'SRT Hellcat', 'SRT Hellcat Redeye', 'SRT Super Stock', 'SRT Demon 170'],
    'DURANGO': ['SXT', 'GT', 'R/T', 'Citadel', 'SRT Hellcat', 'SRT 392'],
    'HORNET': ['GT', 'GT Plus', 'R/T', 'R/T Plus'],
  },
  LEXUS: {
    'RX': ['RX 350', 'RX 350 F Sport', 'RX 350h', 'RX 500h F Sport Performance'],
    'ES': ['ES 250', 'ES 350', 'ES 350 F Sport', 'ES 300h', 'ES 300h Luxury'],
    'IS': ['IS 300', 'IS 350', 'IS 350 F Sport', 'IS 500 F Sport Performance'],
    'NX': ['NX 250', 'NX 350', 'NX 350h', 'NX 450h+'],
    'GX': ['GX 550 Premium', 'GX 550 Premium+', 'GX 550 Luxury', 'GX 550 Luxury+', 'GX 550 Overtrail', 'GX 550 Overtrail+'],
  },
  ACURA: {
    'TLX': ['Base', 'Technology', 'A-Spec', 'Advance', 'Type S', 'Type S PMC Edition'],
    'MDX': ['Base', 'Technology', 'A-Spec', 'Advance', 'Type S', 'Type S Advance'],
    'INTEGRA': ['Base', 'A-Spec', 'A-Spec Technology', 'Type S'],
    'RDX': ['Base', 'Technology', 'A-Spec', 'Advance', 'PMC Edition'],
  },
  AUDI: {
    'A4': ['Premium', 'Premium Plus', 'Prestige', 'S Line'],
    'A6': ['Premium', 'Premium Plus', 'Prestige'],
    'Q5': ['Premium', 'Premium Plus', 'Prestige', 'S Line'],
    'Q7': ['Premium', 'Premium Plus', 'Prestige'],
    'S4': ['Premium Plus', 'Prestige'],
    'RS 5': ['Base', 'Competition'],
  },
  TESLA: {
    'MODEL 3': ['Standard Range Plus', 'Long Range', 'Performance', 'Highland'],
    'MODEL Y': ['Standard Range', 'Long Range', 'Performance'],
    'MODEL S': ['Long Range', 'Plaid'],
    'MODEL X': ['Long Range', 'Plaid'],
  },
};

export const MODEL_ENGINES: Record<string, Record<string, string[]>> = {
  FORD: {
    'F-150': ['2.7L V6 Turbo', '3.3L V6', '3.5L V6 Turbo', '3.5L V6 Turbo Hybrid (PowerBoost)', '5.0L V8'],
    'MUSTANG': ['2.3L 4cyl Turbo', '5.0L V8', '5.2L V8 Supercharged'],
    'EXPLORER': ['2.3L 4cyl Turbo', '3.0L V6 Turbo', '3.3L V6 Hybrid'],
    'ESCAPE': ['1.5L 3cyl Turbo', '2.0L 4cyl Turbo', '2.5L 4cyl Hybrid', '2.5L 4cyl PHEV'],
    'TRANSIT CONNECT': ['2.0L 4cyl', '2.5L 4cyl'],
    'BRONCO': ['2.3L 4cyl Turbo', '2.7L V6 Turbo'],
    'BRONCO SPORT': ['1.5L 3cyl Turbo', '2.0L 4cyl Turbo'],
    'MAVERICK': ['2.0L 4cyl Turbo', '2.5L 4cyl Hybrid'],
    'EDGE': ['2.0L 4cyl Turbo', '2.7L V6 Turbo'],
    'RANGER': ['2.3L 4cyl Turbo', '2.7L V6 Turbo'],
    'EXPEDITION': ['3.5L V6 Turbo'],
    'FUSION': ['1.5L 4cyl Turbo', '2.0L 4cyl Turbo', '2.5L 4cyl', '2.0L 4cyl Hybrid', '2.0L 4cyl PHEV'],
    'FOCUS': ['1.0L 3cyl Turbo', '2.0L 4cyl', '2.0L 4cyl Turbo', '2.3L 4cyl Turbo'],
  },
  TOYOTA: {
    'CAMRY': ['2.5L 4cyl', '2.5L 4cyl Hybrid', '3.5L V6'],
    'COROLLA': ['1.8L 4cyl', '2.0L 4cyl', '1.8L 4cyl Hybrid'],
    'RAV4': ['2.5L 4cyl', '2.5L 4cyl Hybrid', '2.5L 4cyl PHEV'],
    'TACOMA': ['2.4L 4cyl Turbo', '2.4L 4cyl Turbo Hybrid', '2.7L 4cyl', '3.5L V6'],
    'TUNDRA': ['3.5L V6 Turbo (i-FORCE)', '3.5L V6 Turbo Hybrid (i-FORCE MAX)'],
    '4RUNNER': ['2.4L 4cyl Turbo', '2.4L 4cyl Turbo Hybrid', '4.0L V6'],
    'HIGHLANDER': ['2.4L 4cyl Turbo', '2.5L 4cyl Hybrid', '3.5L V6'],
    'PRIUS': ['1.8L 4cyl Hybrid', '2.0L 4cyl Hybrid', '2.0L 4cyl PHEV'],
    'SUPRA': ['2.0L 4cyl Turbo', '3.0L 6cyl Turbo'],
    'COROLLA CROSS': ['2.0L 4cyl', '2.0L 4cyl Hybrid'],
    'GR86': ['2.4L 4cyl'],
  },
  HONDA: {
    'CIVIC': ['1.5L 4cyl Turbo', '2.0L 4cyl', '2.0L 4cyl Turbo', '2.0L 4cyl Hybrid'],
    'ACCORD': ['1.5L 4cyl Turbo', '2.0L 4cyl Turbo', '2.0L 4cyl Hybrid'],
    'CR-V': ['1.5L 4cyl Turbo', '2.0L 4cyl Hybrid'],
    'PILOT': ['3.5L V6', '2.0L 4cyl Turbo'],
    'HR-V': ['2.0L 4cyl'],
    'ODYSSEY': ['3.5L V6'],
    'RIDGELINE': ['3.5L V6'],
    'FIT': ['1.5L 4cyl'],
  },
  CHEVROLET: {
    'SILVERADO 1500': ['2.7L 4cyl Turbo', '3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'SILVERADO': ['2.7L 4cyl Turbo', '3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'CAMARO': ['2.0L 4cyl Turbo', '3.6L V6', '6.2L V8', '6.2L V8 Supercharged'],
    'CORVETTE': ['6.2L V8', '5.5L V8'],
    'EQUINOX': ['1.5L 4cyl Turbo', '2.0L 4cyl Turbo', 'EV'],
    'TAHOE': ['3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'COLORADO': ['2.7L 4cyl Turbo', '3.6L V6', '2.8L 4cyl Diesel'],
    'MALIBU': ['1.5L 4cyl Turbo', '2.0L 4cyl Turbo'],
    'TRAVERSE': ['2.5L 4cyl Turbo'],
    'SUBURBAN': ['3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'BLAZER': ['2.0L 4cyl Turbo', '2.5L 4cyl', '3.6L V6', 'EV'],
  },
  JEEP: {
    'WRANGLER': ['2.0L 4cyl Turbo', '3.0L V6 Diesel', '3.6L V6', '6.4L V8', '2.0L 4cyl Turbo PHEV'],
    'GRAND CHEROKEE': ['2.0L 4cyl Turbo PHEV', '3.6L V6', '5.7L V8', '6.4L V8'],
    'CHEROKEE': ['2.4L 4cyl', '2.0L 4cyl Turbo', '3.2L V6'],
    'GLADIATOR': ['3.0L V6 Diesel', '3.6L V6'],
    'COMPASS': ['2.4L 4cyl', '2.0L 4cyl Turbo'],
    'RENEGADE': ['1.3L 4cyl Turbo', '2.4L 4cyl'],
  },
  RAM: {
    '1500': ['3.0L V6 Diesel', '3.6L V6', '5.7L V8', '5.7L V8 eTorque', '6.2L V8 Supercharged'],
    '2500': ['6.4L V8', '6.7L 6cyl Diesel'],
    '3500': ['6.4L V8', '6.7L 6cyl Diesel'],
  },
  GMC: {
    'SIERRA 1500': ['2.7L 4cyl Turbo', '3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'SIERRA': ['2.7L 4cyl Turbo', '3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'YUKON': ['3.0L 6cyl Diesel', '5.3L V8', '6.2L V8'],
    'CANYON': ['2.7L 4cyl Turbo', '2.8L 4cyl Diesel'],
    'TERRAIN': ['1.5L 4cyl Turbo'],
    'ACADIA': ['2.0L 4cyl Turbo', '2.5L 4cyl Turbo'],
  },
  HYUNDAI: {
    'TUCSON': ['2.5L 4cyl', '1.6L 4cyl Turbo Hybrid', '1.6L 4cyl Turbo PHEV'],
    'SANTA FE': ['2.5L 4cyl', '2.5L 4cyl Turbo', '1.6L 4cyl Turbo Hybrid', '1.6L 4cyl Turbo PHEV'],
    'ELANTRA': ['2.0L 4cyl', '1.6L 4cyl Turbo', '2.0L 4cyl Turbo'],
    'SONATA': ['2.5L 4cyl', '1.6L 4cyl Turbo', '2.5L 4cyl Turbo'],
    'PALISADE': ['3.8L V6', '3.5L V6'],
    'KONA': ['2.0L 4cyl', '1.6L 4cyl Turbo', '2.0L 4cyl Turbo', 'EV'],
  },
  SUBARU: {
    'OUTBACK': ['2.5L 4cyl', '2.4L 4cyl Turbo'],
    'FORESTER': ['2.5L 4cyl', '2.0L 4cyl Turbo'],
    'CROSSTREK': ['2.0L 4cyl', '2.0L 4cyl Hybrid', '2.5L 4cyl'],
    'WRX': ['2.4L 4cyl Turbo'],
    'IMPREZA': ['2.0L 4cyl', '2.5L 4cyl'],
    'BRZ': ['2.4L 4cyl'],
    'ASCENT': ['2.4L 4cyl Turbo'],
  },
  NISSAN: {
    'ALTIMA': ['2.5L 4cyl', '2.0L 4cyl Turbo'],
    'ROGUE': ['1.5L 3cyl Turbo', '2.5L 4cyl'],
    'PATHFINDER': ['3.5L V6'],
    'FRONTIER': ['3.8L V6'],
    'SENTRA': ['2.0L 4cyl'],
    'TITAN': ['5.6L V8'],
    'Z': ['3.0L V6 Turbo'],
  },
  TESLA: {
    'MODEL 3': ['Single Motor', 'Dual Motor', 'Tri Motor'],
    'MODEL Y': ['Single Motor', 'Dual Motor', 'Tri Motor'],
    'MODEL S': ['Dual Motor', 'Tri Motor (Plaid)'],
    'MODEL X': ['Dual Motor', 'Tri Motor (Plaid)'],
  },
};

/**
 * Look up trim options for a specific make + model.
 * Returns empty array if no match (caller should render text input).
 */
export function getTrimOptions(make: string, model: string): string[] {
  if (!make || !model) return [];
  const makeData = MODEL_TRIMS[make.toUpperCase()];
  if (!makeData) return [];
  return makeData[model.toUpperCase()] ?? [];
}

/**
 * Look up engine options for a specific make + model.
 * Returns empty array if no match (caller should render text input).
 */
export function getEngineOptions(make: string, model: string): string[] {
  if (!make || !model) return [];
  const makeData = MODEL_ENGINES[make.toUpperCase()];
  if (!makeData) return [];
  return makeData[model.toUpperCase()] ?? [];
}
