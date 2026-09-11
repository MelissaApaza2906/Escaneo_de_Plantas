import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import {
  Award, BookOpen, Camera, Check, ChevronRight, CircleHelp, Clock3, Compass,
  Droplets, FlaskConical, Heart, Info, Leaf, ListChecks, LoaderCircle, LockKeyhole, LogIn,
  LogOut, Mail, MapPin, Menu, Quote, RotateCcw, Save, Search, Send,
  ShieldCheck, SlidersHorizontal, Sparkles, Sprout, Sun, Target, Trophy,
  UserPlus, UserRound, X,
} from 'lucide-react';
import { identifyPlant, getWikipediaDetails, getGbifHabitat, type PlantIdentifyResult, type WikipediaDetails } from '@/lib/plant-identify';

type View = 'inicio' | 'galeria' | 'aprende' | 'laboratorio' | 'favoritas' | 'acerca' | 'contacto';
type PlantType = 'Todos' | 'Árbol' | 'Arbusto' | 'Hierba' | 'Cactus' | 'Helecho';
type QuizMode = 'explorador' | 'experto';
type Plant = {
  id: string; commonName: string; scientificName: string; photo: string; description: string;
  family: string; habitat: string; medicinalUses: string; care: string; curiousFact: string;
  type: Exclude<PlantType, 'Todos'>; region: string;
};
type User = { name: string; email: string; password: string; institution?: string; course?: string; city?: string };

const queryClient = new QueryClient();
// Cada ficha usa una consulta propia en la fuente solicitada.
const plantPhoto = (name: string) =>
  `https://source.unsplash.com/600x400/?${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '+').replace(/^\+|\+$/g, '').toLowerCase()}+bolivia`;
const img = (index: number) =>
  plantPhoto(['bosque selva Cochabamba', 'eucalipto', 'molle', 'aliso', 'quewina', 'kantuta', 'tarwi', 'achira'][index % 8]);
const fallbackPhoto = 'https://images.pexels.com/photos/1903965/pexels-photo-1903965.jpeg?auto=compress&cs=tinysrgb&w=1200';
const wikiFallback = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg';
async function getWikiImage(scientificName: string): Promise<string> {
  const nombre = scientificName.trim().replace(/\s+/g, '_');
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(nombre)}&prop=pageimages&format=json&pithumbsize=600&origin=*`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
    const pages = data.query?.pages ?? {};
    for (const pageId of Object.keys(pages)) {
      const source = pages[pageId]?.thumbnail?.source;
      if (source) return source;
    }
  } catch {
    // Se usa la imagen neutra cuando Wikipedia no tiene una miniatura disponible.
  }
  return wikiFallback;
}
const imageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = fallbackPhoto;
};

const corePlants: Plant[] = [
  { id: 'eucalipto', commonName: 'Eucalipto', scientificName: 'Eucalyptus globulus', photo: img(1), description: 'Árbol aromático de hojas plateadas que perfuma las laderas y calles altas de Cochabamba.', family: 'Myrtaceae', habitat: 'Laderas templadas y valles interandinos', medicinalUses: 'Sus hojas se emplean tradicionalmente en vahos para aliviar la congestión.', care: 'Sol directo, suelo drenado y riego moderado cuando la superficie esté seca.', curiousFact: 'Puede superar los 50 metros y sus hojas juveniles tienen una forma muy distinta a las adultas.', type: 'Árbol', region: 'Cochabamba' },
  { id: 'molle', commonName: 'Molle', scientificName: 'Schinus molle', photo: img(2), description: 'La copa llorona del molle es una silueta familiar en plazas, quebradas y caminos del valle.', family: 'Anacardiaceae', habitat: 'Valles secos y bosques abiertos', medicinalUses: 'La infusión de sus hojas forma parte de prácticas tradicionales para molestias digestivas.', care: 'Resiste sequía, necesita luz abundante y espacio para extender sus ramas.', curiousFact: 'Sus frutos rosados se parecen a pequeñas pimientas y tienen un aroma resinoso.', type: 'Árbol', region: 'Cochabamba' },
  { id: 'aliso', commonName: 'Aliso', scientificName: 'Alnus acuminata', photo: img(3), description: 'Guardián de los ríos andinos: sus raíces protegen el suelo y acompañan cursos de agua.', family: 'Betulaceae', habitat: 'Riberas húmedas entre 1.500 y 3.500 m', medicinalUses: 'La corteza se ha usado de forma tradicional en cataplasmas para inflamaciones.', care: 'Prefiere humedad constante, sol suave y suelo profundo con materia orgánica.', curiousFact: 'En sus raíces alberga bacterias que ayudan a fijar nitrógeno y enriquecer el suelo.', type: 'Árbol', region: 'Cochabamba' },
  { id: 'quewina', commonName: 'Quewiña', scientificName: 'Polylepis besseri', photo: img(4), description: 'Árbol nativo de corteza cobriza, símbolo de los bosques que sobreviven en las alturas bolivianas.', family: 'Rosaceae', habitat: 'Bosques altoandinos y laderas rocosas', medicinalUses: 'Sus hojas aparecen en preparaciones tradicionales para molestias respiratorias.', care: 'Clima frío, exposición luminosa y riego profundo pero espaciado.', curiousFact: 'Su corteza se desprende en capas finas que protegen al tronco de las heladas.', type: 'Árbol', region: 'Cochabamba' },
  { id: 'kantuta', commonName: 'Kantuta', scientificName: 'Cantua buxifolia', photo: img(5), description: 'Flor nacional de Bolivia, cuyas corolas tubulares pintan de rojo, amarillo y verde los jardines andinos.', family: 'Polemoniaceae', habitat: 'Valles secos y matorrales de altura', medicinalUses: 'En la tradición local sus flores se valoran en infusiones suaves y aromáticas.', care: 'Sol de mañana, poda ligera después de florecer y drenaje generoso.', curiousFact: 'Sus flores cuelgan hacia abajo, una forma perfecta para recibir a los picaflores.', type: 'Arbusto', region: 'Bolivia' },
  { id: 'tarwi', commonName: 'Tarwi', scientificName: 'Lupinus mutabilis', photo: img(6), description: 'Leguminosa andina de flores intensas, cultivada desde hace siglos en las montañas.', family: 'Fabaceae', habitat: 'Parcelas y pastizales entre 2.000 y 4.000 m', medicinalUses: 'Sus semillas son un alimento tradicional de alto valor proteico, luego de desamargarlas.', care: 'Sol pleno, riego regular al inicio y suelo suelto.', curiousFact: 'Sus raíces forman nódulos que capturan nitrógeno del aire y mejoran la tierra.', type: 'Hierba', region: 'Bolivia' },
  { id: 'achira', commonName: 'Achira', scientificName: 'Canna indica', photo: img(7), description: 'Planta de hojas grandes y flores encendidas que aparece junto a acequias y huertos familiares.', family: 'Cannaceae', habitat: 'Bordes húmedos y jardines de valle', medicinalUses: 'Sus rizomas se consumen cocidos en algunas regiones y sus hojas se usan para envolver alimentos.', care: 'Riego frecuente, luz abundante y tierra rica.', curiousFact: 'Sus semillas negras y redondas fueron utilizadas antiguamente como cuentas ornamentales.', type: 'Hierba', region: 'Cochabamba' },
  { id: 'cactus-cola', commonName: 'Cactus cola de zorro', scientificName: 'Cleistocactus samaipatanus', photo: img(0), description: 'Cactus columnar de flores rojas, especialista en sobrevivir al sol intenso y al suelo pedregoso.', family: 'Cactaceae', habitat: 'Quebradas secas y formaciones rocosas', medicinalUses: 'No se recomienda uso casero; su valor principal es ecológico y ornamental.', care: 'Sol directo, sustrato mineral y riegos muy espaciados.', curiousFact: 'Sus flores tubulares son polinizadas principalmente por picaflores.', type: 'Cactus', region: 'Bolivia' },
  { id: 'chilca', commonName: 'Chilca', scientificName: 'Baccharis latifolia', photo: img(1), description: 'Arbusto resinoso que coloniza quebradas y bordes de camino con una fragancia verde y fresca.', family: 'Asteraceae', habitat: 'Quebradas húmedas y bordes de bosque', medicinalUses: 'Sus hojas se emplean en baños tradicionales para aliviar cansancio muscular.', care: 'Sol o semisombra, poda para compactar y riego moderado.', curiousFact: 'Sus semillas tienen pequeños pelos que les permiten viajar con el viento.', type: 'Arbusto', region: 'Cochabamba' },
  { id: 'wira-wira', commonName: 'Wira wira', scientificName: 'Gnaphalium d. S.', photo: img(2), description: 'Hierba de aspecto plateado que guarda memoria de las alturas y de los remedios de abuela.', family: 'Asteraceae', habitat: 'Pajonales y laderas frías', medicinalUses: 'Se prepara tradicionalmente como infusión para la garganta y los cambios de clima.', care: 'Sustrato muy drenado, sol suave y poca humedad en invierno.', curiousFact: 'El vello de sus hojas refleja luz y ayuda a conservar calor en las noches frías.', type: 'Hierba', region: 'Altiplano' },
  { id: 'retama', commonName: 'Retama', scientificName: 'Spartium junceum', photo: img(3), description: 'Arbusto de flores amarillas que ilumina los caminos del valle durante la primavera.', family: 'Fabaceae', habitat: 'Laderas soleadas y caminos rurales', medicinalUses: 'No debe consumirse sin orientación experta; algunas partes son tóxicas.', care: 'Sol pleno, suelo seco y podas de formación.', curiousFact: 'Sus ramas verdes realizan fotosíntesis incluso cuando pierde gran parte de sus hojas.', type: 'Arbusto', region: 'Cochabamba' },
  { id: 'helecho-andino', commonName: 'Helecho andino', scientificName: 'Blechnum cordatum', photo: img(4), description: 'Frondas brillantes que crecen donde la sombra y la humedad encuentran un pequeño refugio.', family: 'Blechnaceae', habitat: 'Bosques de neblina y nacientes de agua', medicinalUses: 'Su uso medicinal no está recomendado sin identificación especializada.', care: 'Semisombra, humedad ambiental alta y sustrato siempre fresco.', curiousFact: 'No produce semillas: se reproduce mediante esporas diminutas en el reverso de sus frondas.', type: 'Helecho', region: 'Yungas' },
  { id: 'jarca', commonName: 'Jarca', scientificName: 'Acacia visco', photo: img(5), description: 'Árbol espinoso de copa abierta, frecuente en valles secos y zonas de transición.', family: 'Fabaceae', habitat: 'Valles secos y matorral espinoso', medicinalUses: 'La corteza aparece en usos tradicionales, siempre bajo conocimiento comunitario.', care: 'Sol pleno, suelo arenoso y riego muy ocasional.', curiousFact: 'Sus flores globosas liberan un perfume dulce que atrae a numerosos insectos.', type: 'Árbol', region: 'Cochabamba' },
  { id: 'tola', commonName: 'Tola', scientificName: 'Parastrephia lepidophylla', photo: img(6), description: 'Matorral aromático del altiplano que resiste viento, frío y meses completos sin lluvia.', family: 'Asteraceae', habitat: 'Puna seca y suelos arenosos', medicinalUses: 'Se usa tradicionalmente en sahúmos y bebidas calientes de montaña.', care: 'Sol pleno, drenaje excelente y muy poco riego.', curiousFact: 'Su resina protege las hojas del frío y reduce la pérdida de agua.', type: 'Arbusto', region: 'Altiplano' },
  { id: 'chirimoya', commonName: 'Chirimoya', scientificName: 'Annona cherimola', photo: img(7), description: 'Frutal de valle con una pulpa cremosa y hojas suaves, cultivado en huertos de clima templado.', family: 'Annonaceae', habitat: 'Valles templados y huertos familiares', medicinalUses: 'Su fruto aporta fibra y vitaminas como parte de una alimentación variada.', care: 'Sol de mañana, riego profundo y protección contra heladas.', curiousFact: 'Sus flores son hermafroditas, pero suelen necesitar ayuda de insectos para polinizarse.', type: 'Árbol', region: 'Cochabamba' },
  { id: 'tumbo', commonName: 'Tumbo', scientificName: 'Passiflora tripartita', photo: img(0), description: 'Enredadera de flores complejas y frutos alargados que trepa por cercos y soportes.', family: 'Passifloraceae', habitat: 'Valles húmedos y bordes de cultivo', medicinalUses: 'El fruto se disfruta en refrescos y preparaciones tradicionales.', care: 'Luz abundante, soporte vertical y riego constante.', curiousFact: 'Su flor parece una pequeña arquitectura y ofrece néctar a sus polinizadores.', type: 'Hierba', region: 'Cochabamba' },
  { id: 'muña', commonName: 'Muña', scientificName: 'Minthostachys mollis', photo: img(1), description: 'Aromática de hojas pequeñas que desprende un perfume mentolado al tocarla.', family: 'Lamiaceae', habitat: 'Laderas secas y campos altoandinos', medicinalUses: 'La infusión se toma tradicionalmente después de las comidas.', care: 'Sol pleno, poda ligera y suelo con drenaje rápido.', curiousFact: 'Su aroma es una defensa natural contra algunos herbívoros.', type: 'Arbusto', region: 'Cochabamba' },
  { id: 'oca', commonName: 'Oca', scientificName: 'Oxalis tuberosa', photo: img(2), description: 'Pequeña planta andina de flores amarillas y tubérculos de colores vivos.', family: 'Oxalidaceae', habitat: 'Cultivos de altura y suelos frescos', medicinalUses: 'El tubérculo es un alimento ancestral que se consume cocido o deshidratado.', care: 'Sol suave, riego regular y aporque durante el crecimiento.', curiousFact: 'La exposición al sol puede cambiar el sabor de sus tubérculos y volverlos más dulces.', type: 'Hierba', region: 'Andes' },
];

const extraNames = [
  ['Kewiña de páramo','Polylepis pauta','Árbol'],['Sauce criollo','Salix humboldtiana','Árbol'],['Kiswara','Buddleja coriacea','Árbol'],['Chachacoma','Escallonia resinosa','Árbol'],['Pino de cerro','Podocarpus parlatorei','Árbol'],['Mara','Swietenia macrophylla','Árbol'],['Cedro','Cedrela odorata','Árbol'],['Nogal andino','Juglans neotropica','Árbol'],['Tipa','Tipuana tipu','Árbol'],['Jacarandá','Jacaranda mimosifolia','Árbol'],['Ceibo','Erythrina falcata','Árbol'],['Tajibo','Handroanthus impetiginosus','Árbol'],['Pacay','Inga edulis','Árbol'],['Guayabo','Psidium guajava','Árbol'],['Duraznero','Prunus persica','Árbol'],['Manzano','Malus domestica','Árbol'],['Granado','Punica granatum','Arbusto'],['Sauco','Sambucus peruviana','Arbusto'],['Lloque','Kageneckia lanceolata','Árbol'],['Palo borracho','Ceiba speciosa','Árbol'],['Café de monte','Psychotria carthagenensis','Arbusto'],['Flor de kantuta blanca','Cantua buxifolia alba','Arbusto'],['Romerillo','Diplostephium venezuelense','Arbusto'],['Paja brava','Festuca orthophylla','Hierba'],['Ichu','Stipa ichu','Hierba'],['Choclo silvestre','Zea mays ssp. parviglumis','Hierba'],['Quinua','Chenopodium quinoa','Hierba'],['Kañiwa','Chenopodium pallidicaule','Hierba'],['Amaranto','Amaranthus caudatus','Hierba'],['Ají silvestre','Capsicum baccatum','Hierba'],['Locoto','Capsicum pubescens','Hierba'],['Papa nativa','Solanum tuberosum','Hierba'],['Tomate de árbol','Solanum betaceum','Árbol'],['Maca','Lepidium meyenii','Hierba'],['Yacón','Smallanthus sonchifolius','Hierba'],['Manzanilla','Matricaria chamomilla','Hierba'],['Cedrón','Aloysia citrodora','Arbusto'],['Toronjil','Melissa officinalis','Hierba'],['Romero','Salvia rosmarinus','Arbusto'],['Orégano','Origanum vulgare','Hierba'],['Ruda','Ruta graveolens','Arbusto'],['Paico','Dysphania ambrosioides','Hierba'],['Anís','Pimpinella anisum','Hierba'],['Menta','Mentha spicata','Hierba'],['Hinojo','Foeniculum vulgare','Hierba'],['Lavanda','Lavandula angustifolia','Arbusto'],['Caléndula','Calendula officinalis','Hierba'],['Diente de león','Taraxacum officinale','Hierba'],['Llantén','Plantago major','Hierba'],['Ortiga','Urtica dioica','Hierba'],['Sábila','Aloe vera','Cactus'],['Tuna','Opuntia ficus-indica','Cactus'],['San Pedro','Echinopsis pachanoi','Cactus'],['Cardón','Trichocereus terscheckii','Cactus'],['Cactus de los Andes','Oreocereus celsianus','Cactus'],['Asiento de suegra','Echinocactus grusonii','Cactus'],['Achuma','Echinopsis lageniformis','Cactus'],['Flor de mayo','Schlumbergera truncata','Cactus'],['Agave azul','Agave tequilana','Cactus'],['Maguey andino','Agave americana','Cactus'],['Begonia de monte','Begonia boliviensis','Hierba'],['Orquídea de Cochabamba','Epidendrum secundum','Hierba'],['Orquídea estrella','Epidendrum ibaguense','Hierba'],['Achupalla','Puya mirabilis','Hierba'],['Puya raimondii','Puya raimondii','Hierba'],['Totora','Schoenoplectus californicus','Hierba'],['Carrizo','Arundo donax','Hierba'],['Cola de caballo','Equisetum bogotense','Helecho'],['Helecho espada','Nephrolepis exaltata','Helecho'],['Helecho macho','Dryopteris wallichiana','Helecho'],['Helecho de la paz','Adiantum raddianum','Helecho'],['Musgo de bosque','Sphagnum magellanicum','Helecho'],['Aguaymanto','Physalis peruviana','Hierba'],['Matico','Piper aduncum','Arbusto'],['Guarango','Mimosa quitensis','Árbol'],['Huarango','Prosopis pallida','Árbol'],['Algarrobo','Prosopis chilensis','Árbol'],['Chañar','Geoffroea decorticans','Árbol'],['Tara','Caesalpinia spinosa','Árbol'],['Molle serrano','Schinus areira','Árbol'],['Palo santo','Bursera graveolens','Árbol'],['Copaibo','Copaifera langsdorffii','Árbol'],['Cuchi','Astronium urundeuva','Árbol'],['Motacú','Attalea phalerata','Árbol'],['Jatata','Geonoma deversa','Hierba'],['Palmera asaí','Euterpe precatoria','Árbol'],['Platanillo','Heliconia rostrata','Hierba'],['Bromelia roja','Aechmea distichantha','Hierba'],['Maracuyá','Passiflora edulis','Hierba'],['Guanábana','Annona muricata','Árbol'],['Papaya','Carica papaya','Árbol'],['Mango','Mangifera indica','Árbol'],['Cacao','Theobroma cacao','Árbol'],['Caña de azúcar','Saccharum officinarum','Hierba'],['Maíz morado','Zea mays','Hierba'],['Frejol','Phaseolus vulgaris','Hierba'],['Haba','Vicia faba','Hierba'],['Arveja','Pisum sativum','Hierba'],['Chía','Salvia hispanica','Hierba'],['Amapola andina','Calceolaria uniflora','Hierba'],['Planta de la resurrección','Selaginella lepidophylla','Helecho'],
] as const;

const generatedPlants: Plant[] = extraNames.map(([commonName, scientificName, type], i) => ({
  id: `especie-${i + 1}`,
  commonName,
  scientificName,
  photo: img(i + 3),
  description: `Especie presente en los paisajes vegetales de Bolivia, registrada por su relación con los suelos, el clima y las comunidades de ${i % 3 === 0 ? 'Cochabamba' : 'los Andes'}.`,
  family: ['Asteraceae', 'Fabaceae', 'Solanaceae', 'Lamiaceae', 'Rosaceae'][i % 5],
  habitat: ['Valles interandinos', 'Bosque montano', 'Laderas secas', 'Quebradas húmedas'][i % 4],
  medicinalUses: 'Su conocimiento tradicional forma parte de la memoria biocultural local; consulta siempre a una persona especialista.',
  care: 'Luz acorde a su hábitat, sustrato con buen drenaje y riego sin encharcamientos.',
  curiousFact: `Su presencia ayuda a leer el estado del ecosistema y revela una historia botánica de más de ${120 + i} años.`,
  type: type as Exclude<PlantType, 'Todos'>,
  region: i % 2 === 0 ? 'Cochabamba' : 'Bolivia',
}));
 const plants: Plant[] = [...corePlants, ...generatedPlants].map((plant) => ({
   ...plant,
   photo: plantPhoto(plant.commonName),
 }));

const questions = [
  { text: '¿Qué árbol protege las riberas de los ríos andinos?', options: ['Aliso', 'Tola', 'Tumbo', 'Retama'], answer: 'Aliso' },
  { text: '¿Cuál es la flor nacional de Bolivia?', options: ['Kantuta', 'Muña', 'Achira', 'Chilca'], answer: 'Kantuta' },
  { text: '¿Qué especie tiene una corteza que se desprende en capas finas?', options: ['Molle', 'Quewiña', 'Tarwi', 'Sauce'], answer: 'Quewiña' },
  { text: '¿Qué planta andina se cultiva por sus tubérculos de colores?', options: ['Oca', 'Aliso', 'Wira wira', 'Helecho'], answer: 'Oca' },
  { text: '¿Qué planta suele crecer junto a acequias y tiene hojas grandes?', options: ['Achira', 'Tola', 'Retama', 'Chirimoya'], answer: 'Achira' },
  { text: '¿Qué planta adapta sus hojas con vello plateado para conservar calor?', options: ['Wira wira', 'Eucalipto', 'Jarca', 'Tumbo'], answer: 'Wira wira' },
  { text: '¿Qué especialista del catálogo se reproduce por esporas?', options: ['Helecho andino', 'Molle', 'Tarwi', 'Kantuta'], answer: 'Helecho andino' },
  { text: '¿Qué planta tiene frutos rosados parecidos a pimientas?', options: ['Molle', 'Chirimoya', 'Tola', 'Muña'], answer: 'Molle' },
  { text: '¿Qué planta trepa y ofrece néctar a sus polinizadores?', options: ['Tumbo', 'Aliso', 'Retama', 'Oca'], answer: 'Tumbo' },
  { text: '¿Qué aroma mentolado caracteriza a una planta de laderas?', options: ['Muña', 'Quewiña', 'Achira', 'Jarca'], answer: 'Muña' },
  { text: '¿Qué leguminosa mejora el suelo al fijar nitrógeno?', options: ['Tarwi', 'Kantuta', 'Tumbo', 'Chirimoya'], answer: 'Tarwi' },
  { text: '¿En qué ambiente se encuentra principalmente la tola?', options: ['Puna seca', 'Ribera tropical', 'Huerto húmedo', 'Bosque de neblina'], answer: 'Puna seca' },
  { text: '¿Qué especie es conocida por sus flores tubulares visitadas por picaflores?', options: ['Cactus cola de zorro', 'Oca', 'Sauce', 'Paico'], answer: 'Cactus cola de zorro' },
  { text: '¿Qué fruto de valle crece en una enredadera?', options: ['Tumbo', 'Molle', 'Aliso', 'Quewiña'], answer: 'Tumbo' },
  { text: '¿Qué planta necesita semisombra y humedad ambiental alta?', options: ['Helecho andino', 'Retama', 'Tola', 'Tarwi'], answer: 'Helecho andino' },
];

function loadUsers(): User[] {
  try { return JSON.parse(localStorage.getItem('sbd-users') || '[]') as User[]; } catch { return []; }
}
function IconButton({ label, onClick, children, active = false }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} className={`focus-ring transition-transform duration-300 hover:scale-105 ${active ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--sidebar-foreground)/.75)]'}`}>{children}</button>;
}

function AppContent() {
  const [view, setView] = useState<View>('inicio');
  const [search, setSearch] = useState('');
  const [plantType, setPlantType] = useState<PlantType>('Todos');
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizMode>('explorador');
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizBestStreak, setQuizBestStreak] = useState(0);
  const [quizTime, setQuizTime] = useState(45);
  const [wikiImages, setWikiImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const email = localStorage.getItem('sbd-session');
    const user = loadUsers().find((item) => item.email === email) || null;
    setCurrentUser(user);
    if (user) setFavorites(JSON.parse(localStorage.getItem(`sbd-favs-${user.email}`) || '[]') as string[]);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadWikiImages = async () => {
      const entries = await Promise.all(plants.map(async (plant) => [plant.id, await getWikiImage(plant.scientificName)] as const));
      if (!cancelled) setWikiImages(Object.fromEntries(entries));
    };
    void loadWikiImages();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const filteredPlants = useMemo(() => plants.filter((plant) => {
    const matchText = plant.commonName.toLowerCase().includes(search.toLowerCase()) || plant.scientificName.toLowerCase().includes(search.toLowerCase());
    return matchText && (plantType === 'Todos' || plant.type === plantType);
  }), [search, plantType]);
  const displayPlants = useMemo(() => plants.map((plant) => ({ ...plant, photo: wikiImages[plant.id] || plant.photo })), [wikiImages]);
  const favoritePlants = useMemo(() => displayPlants.filter((plant) => favorites.includes(plant.id)), [displayPlants, favorites]);

  const navigate = (next: View) => { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleFavorite = (id: string) => {
    if (!currentUser) { setAuthMode('login'); setAuthOpen(true); setToast('Inicia sesión para guardar especies'); return; }
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next); localStorage.setItem(`sbd-favs-${currentUser.email}`, JSON.stringify(next));
    setToast(favorites.includes(id) ? 'Especie retirada de tus favoritas' : 'Especie guardada en tus favoritas');
  };
  const signOut = () => { localStorage.removeItem('sbd-session'); setCurrentUser(null); setFavorites([]); setToast('Sesión cerrada'); };
  const finishQuiz = (answer: string) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(answer);
    if (answer === questions[quizIndex].answer) {
      setQuizScore((score) => score + (quizMode === 'experto' ? 2 : 1));
      setQuizStreak((streak) => {
        const next = streak + 1;
        setQuizBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setQuizStreak(0);
    }
    window.setTimeout(() => {
      if (quizIndex === questions.length - 1) setQuizDone(true);
      else { setQuizIndex((index) => index + 1); setQuizAnswer(null); setQuizTime(quizMode === 'experto' ? 25 : 45); }
    }, 600);
  };
  useEffect(() => {
    if (view !== 'aprende' || quizDone || quizAnswer !== null || quizMode !== 'experto') return undefined;
    const timer = window.setInterval(() => {
      setQuizTime((time) => Math.max(0, time - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [view, quizDone, quizAnswer, quizMode, quizIndex]);
  useEffect(() => {
    if (view === 'aprende' && quizMode === 'experto' && quizTime === 0 && quizAnswer === null && !quizDone) finishQuiz('');
  }, [view, quizMode, quizTime, quizAnswer, quizDone, quizIndex]);
  const restartQuiz = (mode = quizMode) => { setQuizMode(mode); setQuizIndex(0); setQuizScore(0); setQuizStreak(0); setQuizBestStreak(0); setQuizTime(mode === 'experto' ? 25 : 45); setQuizAnswer(null); setQuizDone(false); };

  return (
    <div className="forest-grain min-h-[100dvh] bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--sidebar-foreground)/.12)] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
        <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <button type="button" onClick={() => navigate('inicio')} data-testid="button-brand-home" className="focus-ring flex items-center gap-3 text-left">
            <span className="grid size-10 place-items-center rounded-[13px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm"><Leaf size={22} strokeWidth={2.5} /></span>
            <span><span className="display block text-[19px] leading-none">Sistema Botánico</span><span className="mono mt-1 block text-[9px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.65)]">biblioteca viva</span></span>
          </button>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            {([['inicio', 'Inicio'], ['galeria', 'Galería'], ['aprende', 'Aprende'], ['laboratorio', 'Laboratorio'], ['favoritas', 'Mis favoritas'], ['acerca', 'Acerca de'], ['contacto', 'Contacto']] as [View, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => navigate(id)} data-testid={`nav-${id}`} className={`focus-ring rounded-full px-3 py-2 text-[13px] transition-colors hover:bg-[hsl(var(--sidebar-foreground)/.1)] ${view === id ? 'bg-[hsl(var(--sidebar-foreground)/.12)] text-[hsl(var(--accent))]' : 'text-[hsl(var(--sidebar-foreground)/.78)]'}`}>{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {currentUser ? <button type="button" onClick={() => setProfileOpen(true)} data-testid="button-open-profile" className="hidden items-center gap-2 text-xs text-[hsl(var(--sidebar-foreground)/.7)] hover:text-[hsl(var(--sidebar-foreground))] sm:flex"><span className="grid size-8 place-items-center rounded-full bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent))]">{currentUser.name.slice(0, 1).toUpperCase()}</span>{currentUser.name}<UserRound size={14} /></button> : <button type="button" onClick={() => { setAuthMode('login'); setAuthOpen(true); }} data-testid="button-open-login" className="hidden items-center gap-2 rounded-full border border-[hsl(var(--sidebar-foreground)/.25)] px-4 py-2 text-xs transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] sm:flex"><LogIn size={15} /> Ingresar</button>}
            <IconButton label="abrir menú" onClick={() => setMobileNav((open) => !open)}><Menu className="lg:hidden" size={23} /></IconButton>
          </div>
        </div>
        {mobileNav && <div className="border-t border-[hsl(var(--sidebar-foreground)/.12)] px-5 pb-5 pt-3 lg:hidden">{(['inicio', 'galeria', 'aprende', 'laboratorio', 'favoritas', 'acerca', 'contacto'] as View[]).map((id) => <button key={id} type="button" onClick={() => navigate(id)} data-testid={`mobile-nav-${id}`} className="block w-full border-b border-[hsl(var(--sidebar-foreground)/.1)] py-3 text-left text-sm">{id === 'inicio' ? 'Inicio' : id === 'galeria' ? 'Galería' : id === 'aprende' ? 'Aprende' : id === 'laboratorio' ? 'Laboratorio' : id === 'favoritas' ? 'Mis favoritas' : id === 'acerca' ? 'Acerca de' : 'Contacto'}</button>)}{currentUser ? <button type="button" onClick={() => { setMobileNav(false); setProfileOpen(true); }} data-testid="mobile-nav-perfil" className="flex w-full items-center gap-2 py-3 text-left text-sm text-[hsl(var(--accent))]"><UserRound size={16} /> Mi perfil</button> : <button type="button" onClick={() => { setMobileNav(false); setAuthMode('login'); setAuthOpen(true); }} data-testid="mobile-nav-ingresar" className="flex w-full items-center gap-2 py-3 text-left text-sm text-[hsl(var(--accent))]"><LogIn size={16} /> Ingresar</button>}</div>}
      </header>

      <main>
        {view === 'inicio' && <HomeView navigate={navigate} plants={displayPlants} setSelectedPlant={setSelectedPlant} toggleFavorite={toggleFavorite} favorites={favorites} openCamera={() => setCameraOpen(true)} />}
        {view === 'galeria' && <GalleryView plants={filteredPlants.map((plant) => ({ ...plant, photo: wikiImages[plant.id] || plant.photo }))} allCount={plants.length} search={search} setSearch={setSearch} plantType={plantType} setPlantType={setPlantType} setSelectedPlant={setSelectedPlant} toggleFavorite={toggleFavorite} favorites={favorites} />}
        {view === 'favoritas' && <FavoritesView isLoggedIn={!!currentUser} plants={favoritePlants} openAuth={() => { setAuthMode('login'); setAuthOpen(true); }} setSelectedPlant={setSelectedPlant} toggleFavorite={toggleFavorite} favorites={favorites} navigate={navigate} />}
        {view === 'aprende' && <LearnView quizIndex={quizIndex} quizScore={quizScore} quizAnswer={quizAnswer} quizDone={quizDone} quizMode={quizMode} quizTime={quizTime} quizStreak={quizStreak} quizBestStreak={quizBestStreak} answer={finishQuiz} restart={restartQuiz} />}
        {view === 'laboratorio' && <LaboratoryView plants={displayPlants} setSelectedPlant={setSelectedPlant} />}
        {view === 'acerca' && <AboutView navigate={navigate} count={plants.length} />}
        {view === 'contacto' && <ContactView setToast={setToast} />}
      </main>

      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(158 29% 18%)] px-5 py-10 text-[hsl(var(--sidebar-foreground))] lg:px-10">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 md:flex-row md:items-end">
          <div><div className="display flex items-center gap-2 text-xl"><Leaf size={20} className="text-[hsl(var(--accent))]" /> Sistema Botánico Digital</div><p className="mt-2 max-w-sm text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.6)]">Un mapa de conocimiento para mirar, reconocer y cuidar la flora de Bolivia.</p></div>
          <div className="text-left md:text-right"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Cochabamba · Bolivia</p><p className="mt-2 text-xs text-[hsl(var(--sidebar-foreground)/.55)]">Hecho para aprender con curiosidad.</p></div>
        </div>
      </footer>

      {selectedPlant && <PlantDetail plant={selectedPlant} isFavorite={favorites.includes(selectedPlant.id)} toggleFavorite={toggleFavorite} close={() => setSelectedPlant(null)} />}
      {cameraOpen && <CameraDialog close={() => setCameraOpen(false)} plants={displayPlants} onSelectPlant={(plant) => { setSelectedPlant(plant); setCameraOpen(false); }} />}
      {authOpen && <EnhancedAuthDialog mode={authMode} setMode={setAuthMode} close={() => setAuthOpen(false)} onSuccess={(user) => { setCurrentUser(user); setFavorites(JSON.parse(localStorage.getItem(`sbd-favs-${user.email}`) || '[]') as string[]); setAuthOpen(false); setToast(`Bienvenida, ${user.name}`); }} />}
      {profileOpen && currentUser && <ProfileDialog user={currentUser} close={() => setProfileOpen(false)} onSaved={(user) => { setCurrentUser(user); setProfileOpen(false); setToast('Tus datos personales fueron guardados'); }} signOut={signOut} />}
      {toast && <div role="status" data-testid="status-toast" className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 animate-rise rounded-full bg-[hsl(var(--sidebar))] px-5 py-3 text-sm text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-lg)]">{toast}</div>}
    </div>
  );
}

function SectionHeading({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h2 className="display text-3xl text-[hsl(var(--foreground))] md:text-4xl">{title}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p></div>{action}</div>;
}

function HomeView({ navigate, plants, setSelectedPlant, toggleFavorite, favorites, openCamera }: { navigate: (v: View) => void; plants: Plant[]; setSelectedPlant: (p: Plant) => void; toggleFavorite: (id: string) => void; favorites: string[]; openCamera: () => void }) {
  return <div>
    <section className="relative isolate min-h-[570px] overflow-hidden bg-[hsl(159_35%_17%)]">
       <img src={img(0)} onError={imageFallback} alt="Bosque húmedo de las montañas de Cochabamba" className="absolute inset-0 -z-20 size-full object-cover object-center opacity-70" /><div className="hero-wash absolute inset-0 -z-10" />
      <div className="mx-auto flex min-h-[570px] max-w-[1240px] items-center px-5 py-20 lg:px-10"><div className="max-w-2xl animate-rise text-[hsl(var(--sidebar-foreground))]">
        <div className="mb-6 flex items-center gap-3"><span className="h-px w-10 bg-[hsl(var(--accent))]" /><span className="mono text-[10px] uppercase tracking-[.24em] text-[hsl(var(--accent))]">Explora la flora de Bolivia</span></div>
        <h1 className="display max-w-2xl text-5xl leading-[.98] tracking-[-.03em] md:text-7xl">Cada hoja guarda una historia.</h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-[hsl(var(--sidebar-foreground)/.77)] md:text-lg">Una biblioteca visual para reconocer las especies que habitan nuestros valles, bosques y alturas. Empieza por Cochabamba.</p>
         <div className="mt-9 flex flex-wrap gap-3"><button type="button" onClick={() => navigate('galeria')} data-testid="button-explore-gallery" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-6 py-3 text-sm font-bold text-[hsl(var(--accent-foreground))] shadow-[0_8px_24px_hsl(42_72%_55%/.2)] transition-transform hover:-translate-y-1">Abrir la galería <ChevronRight size={17} /></button><button type="button" onClick={openCamera} data-testid="button-scan-camera" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent)/.8)] bg-[hsl(var(--accent)/.12)] px-6 py-3 text-sm font-bold text-[hsl(var(--sidebar-foreground))] backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"><Camera size={17} /> Escanear con cámara</button><button type="button" disabled title="Próximamente disponible" data-testid="button-identify-ai" className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-[hsl(var(--sidebar-foreground)/.2)] px-5 py-3 text-sm text-[hsl(var(--sidebar-foreground)/.55)]"><Sparkles size={16} /> Identificar con IA · Próximamente disponible</button><button type="button" onClick={() => navigate('aprende')} data-testid="button-start-learning" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[hsl(var(--sidebar-foreground)/.4)] px-6 py-3 text-sm text-[hsl(var(--sidebar-foreground))] transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))]">Poner a prueba lo aprendido <Sparkles size={16} /></button></div>
      </div></div>
      <div className="absolute bottom-8 right-8 hidden max-w-[190px] rounded-2xl border border-[hsl(var(--sidebar-foreground)/.2)] bg-[hsl(var(--sidebar)/.45)] p-4 backdrop-blur-md lg:block"><p className="mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">En este paisaje</p><p className="display mt-2 text-lg">Bosque montano</p><p className="mt-1 text-xs text-[hsl(var(--sidebar-foreground)/.6)]">La humedad dibuja caminos entre las hojas.</p></div>
    </section>
    <section className="mx-auto max-w-[1240px] px-5 py-16 lg:px-10"><SectionHeading eyebrow="Una colección para observar" title="Empieza por las especies del valle" body="Fichas claras, fotografías evocadoras y saberes locales para estudiar a tu propio ritmo." action={<button type="button" onClick={() => navigate('galeria')} data-testid="button-see-all-plants" className="focus-ring inline-flex items-center gap-1 text-sm font-bold text-[hsl(var(--primary))] hover:text-[hsl(var(--accent-foreground))]">Ver las {plants.length} especies <ChevronRight size={16} /></button>} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{plants.slice(0, 4).map((plant, i) => <PlantCard key={plant.id} plant={plant} delay={i} isFavorite={favorites.includes(plant.id)} onOpen={() => setSelectedPlant(plant)} onFavorite={() => toggleFavorite(plant.id)} />)}</div></section>
     <section className="bg-[hsl(196_53%_87%/.55)] px-5 py-16 lg:px-10"><div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Bitácora de campo</p><h2 className="display mt-3 text-4xl leading-tight">Aprender también es hacer preguntas.</h2><p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Descubre familias, hábitats y usos tradicionales. Cuando estés listo, responde nuestro reto de 15 preguntas.</p><button type="button" onClick={() => navigate('laboratorio')} data-testid="button-open-lab" className="focus-ring mt-7 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-1">Abrir el laboratorio <FlaskConical size={16} /></button></div><div className="relative min-h-[250px] overflow-hidden rounded-[2rem] bg-[hsl(var(--primary))] p-8 text-[hsl(var(--primary-foreground))] shadow-leaf"><div className="absolute -right-5 -top-10 size-44 rounded-full border-[22px] border-[hsl(var(--accent)/.65)]" /><div className="absolute -bottom-14 left-16 size-48 rounded-full border-[12px] border-[hsl(var(--secondary)/.3)]" /><Quote className="relative text-[hsl(var(--accent))]" size={32} /><p className="display relative mt-6 max-w-lg text-3xl leading-tight">“Conocer una planta es el primer gesto para proteger el lugar que la sostiene.”</p><p className="mono relative mt-6 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary-foreground)/.6)]">Cuaderno de campo · 01</p></div></div></section>
  </div>;
}

function GalleryView({ plants: filtered, allCount, search, setSearch, plantType, setPlantType, setSelectedPlant, toggleFavorite, favorites }: { plants: Plant[]; allCount: number; search: string; setSearch: (v: string) => void; plantType: PlantType; setPlantType: (v: PlantType) => void; setSelectedPlant: (p: Plant) => void; toggleFavorite: (id: string) => void; favorites: string[] }) {
  return <div className="mx-auto max-w-[1240px] px-5 py-12 lg:px-10 lg:py-16"><div className="animate-rise"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Catálogo vivo / 2024</p><h1 className="display mt-3 text-5xl">Galería botánica</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">Busca por nombre, filtra por tipo y abre cualquier ficha para mirar más de cerca.</p></div>
    <div className="mt-9 flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-sm md:flex-row md:items-center"><div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-plants" placeholder="Busca eucalipto, molle, quewiña..." className="focus-ring w-full rounded-xl bg-[hsl(var(--muted)/.6)] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></div><div className="flex items-center gap-2 overflow-x-auto px-1"><SlidersHorizontal size={16} className="shrink-0 text-[hsl(var(--primary))]" />{(['Todos', 'Árbol', 'Arbusto', 'Hierba', 'Cactus', 'Helecho'] as PlantType[]).map((type) => <button type="button" key={type} onClick={() => setPlantType(type)} data-testid={`filter-${type.toLowerCase()}`} className={`focus-ring shrink-0 rounded-full px-3 py-2 text-xs transition-colors ${plantType === type ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'}`}>{type}</button>)}</div></div>
    <div className="mb-5 mt-7 flex items-center justify-between"><p className="mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{filtered.length} de {allCount} registros</p>{search && <button type="button" onClick={() => setSearch('')} data-testid="button-clear-search" className="text-xs text-[hsl(var(--primary))]">Limpiar búsqueda</button>}</div>
    {filtered.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((plant, i) => <PlantCard key={plant.id} plant={plant} delay={i % 4} isFavorite={favorites.includes(plant.id)} onOpen={() => setSelectedPlant(plant)} onFavorite={() => toggleFavorite(plant.id)} />)}</div> : <EmptyState search={search} clear={() => { setSearch(''); setPlantType('Todos'); }} />}
  </div>;
}

function PlantCard({ plant, delay, isFavorite, onOpen, onFavorite }: { plant: Plant; delay: number; isFavorite: boolean; onOpen: () => void; onFavorite: () => void }) {
  return <article className={`group animate-rise delay-${delay} overflow-hidden rounded-[1.35rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]`} data-testid={`card-plant-${plant.id}`}><div className="relative h-48 overflow-hidden bg-[hsl(var(--secondary))]"><img src={plant.photo} onError={imageFallback} alt={plant.commonName} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[hsl(158_26%_12%/.6)] to-transparent" /><span className="absolute bottom-3 left-3 rounded-full bg-[hsl(var(--card)/.85)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--primary))] backdrop-blur-sm">{plant.type}</span><button type="button" onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label={isFavorite ? `Quitar ${plant.commonName} de favoritas` : `Guardar ${plant.commonName}`} data-testid={`button-favorite-${plant.id}`} className={`focus-ring absolute right-3 top-3 grid size-9 place-items-center rounded-full backdrop-blur-sm transition-all ${isFavorite ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--card)/.8)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]'}`}><Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} /></button></div><button type="button" onClick={onOpen} data-testid={`button-open-plant-${plant.id}`} className="focus-ring block w-full p-4 text-left"><h3 className="display text-xl">{plant.commonName}</h3><p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">{plant.scientificName}</p><div className="mt-4 flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-1"><MapPin size={12} /> {plant.region}</span><span className="font-bold text-[hsl(var(--primary))]">Ver ficha <ChevronRight className="inline" size={13} /></span></div></button></article>;
}

function EmptyState({ search, clear }: { search: string; clear: () => void }) {
  return <div className="animate-rise rounded-[2rem] border border-dashed border-[hsl(var(--primary)/.35)] bg-[hsl(var(--secondary)/.35)] px-6 py-20 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><Search size={25} /></span><h2 className="display mt-5 text-2xl">No encontramos esa especie</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{search ? `No hay resultados para “${search}”. Prueba con otro nombre o vuelve a mirar la colección completa.` : 'Prueba con otro tipo de planta para continuar explorando.'}</p><button type="button" onClick={clear} data-testid="button-reset-filters" className="mt-6 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Ver toda la colección</button></div>;
}

function FavoritesView({ isLoggedIn, plants: favorites, openAuth, setSelectedPlant, toggleFavorite, favorites: favoriteIds, navigate }: { isLoggedIn: boolean; plants: Plant[]; openAuth: () => void; setSelectedPlant: (p: Plant) => void; toggleFavorite: (id: string) => void; favorites: string[]; navigate: (v: View) => void }) {
  if (!isLoggedIn) return <div className="mx-auto flex min-h-[650px] max-w-2xl flex-col items-center justify-center px-5 py-20 text-center"><div className="animate-drift grid size-20 place-items-center rounded-[28px] bg-[hsl(var(--accent)/.25)] text-[hsl(var(--primary))]"><Heart size={34} /></div><p className="mono mt-7 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Tu cuaderno personal</p><h1 className="display mt-3 text-4xl">Guarda las plantas que te llaman.</h1><p className="mt-3 max-w-md text-sm leading-7 text-[hsl(var(--muted-foreground))]">Inicia sesión para construir tu propia colección de especies y volver a ellas cuando quieras.</p><button type="button" onClick={openAuth} data-testid="button-login-favorites" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">Ingresar a mi cuaderno <LogIn size={16} /></button></div>;
  return <div className="mx-auto max-w-[1240px] px-5 py-12 lg:px-10 lg:py-16"><SectionHeading eyebrow="Tu herbario digital" title="Mis favoritas" body={favorites.length ? 'Un lugar para reunir las especies que quieres observar otra vez.' : 'Todavía no has guardado ninguna especie.'} action={<span className="mono rounded-full bg-[hsl(var(--accent)/.25)] px-3 py-2 text-[10px] text-[hsl(var(--primary))]">{favorites.length} guardadas</span>} />{favorites.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{favorites.map((plant, i) => <PlantCard key={plant.id} plant={plant} delay={i % 4} isFavorite={favoriteIds.includes(plant.id)} onOpen={() => setSelectedPlant(plant)} onFavorite={() => toggleFavorite(plant.id)} />)}</div> : <div className="rounded-[2rem] border border-dashed border-[hsl(var(--primary)/.3)] bg-[hsl(var(--secondary)/.32)] px-6 py-16 text-center"><Sprout size={30} className="mx-auto text-[hsl(var(--primary))]" /><h2 className="display mt-4 text-2xl">Tu colección comienza con una mirada</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Explora la galería y toca el corazón de una especie para guardarla aquí.</p><button type="button" onClick={() => navigate('galeria')} data-testid="button-browse-for-favorites" className="mt-6 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">Explorar especies</button></div>}</div>;
}

function PlantDetail({ plant, isFavorite, toggleFavorite, close }: { plant: Plant; isFavorite: boolean; toggleFavorite: (id: string) => void; close: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(158_26%_12%/.7)] p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" data-testid="dialog-plant-detail"><div className="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-[hsl(var(--card))] shadow-[var(--shadow-lg)] sm:rounded-[2rem]"><button type="button" onClick={close} aria-label="Cerrar ficha" data-testid="button-close-plant-detail" className="focus-ring absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-[hsl(var(--card)/.85)] text-[hsl(var(--foreground))] backdrop-blur-sm"><X size={19} /></button><div className="grid md:grid-cols-[1.05fr_.95fr]"><div className="relative min-h-[360px] bg-[hsl(var(--secondary))] md:min-h-[650px]"><img src={plant.photo} onError={imageFallback} alt={plant.commonName} className="absolute inset-0 size-full object-cover" /><div className="image-fade absolute inset-0" /><div className="absolute bottom-7 left-6 text-[hsl(var(--sidebar-foreground))] md:left-8"><span className="mono rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-[9px] uppercase tracking-[.15em] text-[hsl(var(--accent-foreground))]">{plant.type}</span><h2 className="display mt-3 text-4xl">{plant.commonName}</h2><p className="mt-1 text-sm italic text-[hsl(var(--sidebar-foreground)/.7)]">{plant.scientificName}</p></div></div><div className="p-6 md:p-9"><p className="text-sm leading-7 text-[hsl(var(--muted-foreground))]">{plant.description}</p><div className="mt-6 grid gap-4 border-y border-[hsl(var(--border))] py-5 sm:grid-cols-2"><InfoLine icon={<MapPin size={15} />} label="Hábitat" text={plant.habitat} /><InfoLine icon={<Leaf size={15} />} label="Familia" text={plant.family} /></div><div className="space-y-5 py-6"><InfoLine icon={<ShieldCheck size={16} />} label="Usos tradicionales" text={plant.medicinalUses} /><InfoLine icon={<Droplets size={16} />} label="Cuidados" text={plant.care} /><InfoLine icon={<Sparkles size={16} />} label="Dato curioso" text={plant.curiousFact} /></div><button type="button" onClick={() => toggleFavorite(plant.id)} data-testid="button-detail-favorite" className={`focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors ${isFavorite ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`}><Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />{isFavorite ? 'Guardada en favoritas' : 'Guardar en favoritas'}</button></div></div></div></div>;
}

function CameraDialog({ close, plants, onSelectPlant }: { close: () => void; plants: Plant[]; onSelectPlant: (plant: Plant) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [captured, setCaptured] = useState('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState('');
  const [identifyResult, setIdentifyResult] = useState<PlantIdentifyResult | null>(null);
  const [wikiDetails, setWikiDetails] = useState<WikipediaDetails | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [gbifHabitat, setGbifHabitat] = useState<string | null>(null);
  const [gbifLoading, setGbifLoading] = useState(false);

  const retake = () => { setCaptured(''); setCapturedBlob(null); setIdentifyResult(null); setIdentifyError(''); setWikiDetails(null); setGbifHabitat(null); };
  const normalize = (value: string) => value.trim().toLowerCase();
  const findCatalogMatch = (scientificName: string) =>
    plants.find((plant) => normalize(plant.scientificName) === normalize(scientificName));
  // The ~100 auto-generated catalog entries (id "especie-N") have real
  // commonName/scientificName but templated description/medicinalUses/care
  // (identical boilerplate across all of them) — not real per-species data,
  // so they must not count as "we already have this field" in the cascade.
  // The ~18 hand-curated entries have semantic ids ("eucalipto", "kantuta"...).
  const isCuratedCatalogEntry = (plant: Plant) => !plant.id.startsWith('especie-');

  const runIdentify = async () => {
    if (!capturedBlob) return;
    setIdentifying(true);
    setIdentifyError('');
    setIdentifyResult(null);
    setWikiDetails(null);
    setGbifHabitat(null);
    try {
      const result = await identifyPlant(capturedBlob);
      setIdentifyResult(result);
      const topMatch = result.matches[0];
      const catalogMatch = topMatch ? findCatalogMatch(topMatch.scientificName) : undefined;
      const curatedMatch = catalogMatch && isCuratedCatalogEntry(catalogMatch) ? catalogMatch : undefined;
      const hasDescription = Boolean(result.enrichment?.description || curatedMatch?.description);
      const hasUtility = Boolean(result.enrichment?.utility || curatedMatch?.medicinalUses);

      if (topMatch && (!hasDescription || !hasUtility)) {
        setWikiLoading(true);
        const details = await getWikipediaDetails(topMatch.scientificName);
        setWikiDetails(details);
        setWikiLoading(false);

        if (!hasDescription && !details.description && !details.habitat) {
          setGbifLoading(true);
          setGbifHabitat(await getGbifHabitat(topMatch.scientificName));
          setGbifLoading(false);
        }
      }
    } catch (err) {
      setIdentifyError(err instanceof Error ? err.message : 'No se pudo identificar la planta.');
    } finally {
      setIdentifying(false);
    }
  };

  const topMatch = identifyResult?.matches[0] ?? null;
  const topCatalogMatch = topMatch ? findCatalogMatch(topMatch.scientificName) : undefined;
  const curatedCatalogMatch = topCatalogMatch && isCuratedCatalogEntry(topCatalogMatch) ? topCatalogMatch : undefined;
  const enrichment = identifyResult?.enrichment ?? null;
  // commonName uses topCatalogMatch (curated or generated): the generated
  // entries' name/scientific name are real, only their prose fields are boilerplate.
  const resolvedCommonName = enrichment?.commonName || topCatalogMatch?.commonName || topMatch?.commonNames[0] || null;
  const resolvedDescription = enrichment?.description || curatedCatalogMatch?.description || wikiDetails?.description || null;
  const careDetails = [
    enrichment?.watering ? `Riego: ${enrichment.watering}` : null,
    enrichment?.sunlight ? `Luz: ${enrichment.sunlight}` : null,
    enrichment?.growth ? `Crecimiento: ${enrichment.growth}` : null,
  ].filter((line): line is string => Boolean(line));
  const habitatLine = wikiDetails?.habitat || gbifHabitat || null;
  const careFallback = !resolvedDescription && careDetails.length === 0 && !habitatLine ? curatedCatalogMatch?.care ?? null : null;
  const characteristics = [resolvedDescription, ...careDetails, habitatLine, careFallback].filter((part): part is string => Boolean(part));
  const resolvedUtility = enrichment?.utility || curatedCatalogMatch?.medicinalUses || wikiDetails?.uses || null;
  const searchingMore = wikiLoading || gbifLoading;

  useEffect(() => {
    let active = true;
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no permite acceder a la cámara desde esta página.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError('No pudimos activar la cámara. Revisa el permiso del navegador e inténtalo nuevamente.');
      }
    };
    void startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setError('La cámara todavía se está preparando. Espera un momento.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCaptured(canvas.toDataURL('image/jpeg', 0.88));
    canvas.toBlob((blob) => setCapturedBlob(blob), 'image/jpeg', 0.88);
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[hsl(158_26%_12%/.8)] p-4 backdrop-blur-md" role="dialog" aria-modal="true" data-testid="dialog-camera">
    <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-[hsl(var(--card))] shadow-[var(--shadow-lg)]">
      <button type="button" onClick={close} aria-label="Cerrar cámara" data-testid="button-close-camera" className="focus-ring absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-[hsl(var(--card)/.85)] text-[hsl(var(--foreground))] backdrop-blur-sm"><X size={19} /></button>
      <div className="p-6 pb-4 md:p-8 md:pb-5"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Cuaderno de campo</p><h2 className="display mt-2 text-3xl">Escanear con cámara</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Toma una foto de una planta para observarla con más atención.</p></div>
      <div className="relative aspect-[4/3] overflow-hidden bg-[hsl(var(--sidebar))]">
        {captured ? <img src={captured} alt="Foto capturada durante la exploración" className="size-full object-cover" /> : <video ref={videoRef} muted playsInline autoPlay className="size-full object-cover" />}
        {!captured && <div className="pointer-events-none absolute inset-6 rounded-[1.5rem] border border-white/50 shadow-[0_0_0_999px_rgba(13,39,30,.16)]" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-6 md:p-8 md:pt-5">
        <p role={error ? 'alert' : undefined} className={`max-w-sm text-xs leading-5 ${error ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{error || (captured ? 'Foto lista. Identifícala, vuelve a tomarla o cierra esta ventana.' : 'Acepta el permiso de cámara para comenzar.')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={close} className="focus-ring rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-bold">Cerrar</button>
          {captured && <button type="button" onClick={retake} className="focus-ring rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-bold">Tomar otra</button>}
          {!captured && <button type="button" onClick={takePhoto} data-testid="button-take-photo" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Camera size={16} /> Tomar foto</button>}
          {captured && <button type="button" onClick={runIdentify} disabled={identifying || !capturedBlob} data-testid="button-identify-plant" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--accent-foreground))] disabled:opacity-60">{identifying ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}{identifying ? 'Identificando…' : 'Identificar planta'}</button>}
        </div>
      </div>
      {(identifyError || identifyResult) && (
        <div className="border-t border-[hsl(var(--border))] p-6 md:p-8" data-testid="panel-identify-results">
          {identifyError && <p role="alert" className="text-sm text-[hsl(var(--destructive))]">{identifyError}</p>}
          {identifyResult && identifyResult.matches.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No se encontró una coincidencia confiable. Intenta con una foto más cercana de una hoja o flor.</p>}
          {identifyResult && topMatch && (
            <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-5" data-testid="panel-plant-details">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="display text-2xl">{resolvedCommonName || topMatch.scientificName}</h3>
                <span className="mono text-xs text-[hsl(var(--accent))]">{Math.round(topMatch.score * 100)}% de coincidencia</span>
              </div>
              <p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">{topMatch.scientificName}</p>
              <div className="mt-4 space-y-1">
                <p className="mono text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Características</p>
                {searchingMore ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Buscando más información…</p>
                ) : (
                  <p className="text-sm leading-6">{characteristics.length > 0 ? characteristics.join(' · ') : 'No disponible.'}</p>
                )}
              </div>
              <div className="mt-3 space-y-1">
                <p className="mono text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Utilidad</p>
                {searchingMore ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Buscando más información…</p>
                ) : (
                  <p className="text-sm leading-6">{resolvedUtility || 'No disponible.'}</p>
                )}
              </div>
              {topCatalogMatch && <button type="button" onClick={() => onSelectPlant(topCatalogMatch)} data-testid="button-view-top-match" className="focus-ring mt-4 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]">Ver ficha completa</button>}
            </div>
          )}
          {identifyResult && identifyResult.matches.length > 0 && (
            <div className="space-y-3">
              <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Otras coincidencias de PlantNet</p>
              {identifyResult.matches.map((match, i) => {
                const catalogMatch = findCatalogMatch(match.scientificName);
                return (
                  <div key={`${match.scientificName}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] p-4">
                    <div>
                      <p className="text-sm font-bold">{match.commonNames[0] || match.scientificName}</p>
                      <p className="text-xs italic text-[hsl(var(--muted-foreground))]">{match.scientificName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="mono text-xs text-[hsl(var(--accent))]">{Math.round(match.score * 100)}%</span>
                      {catalogMatch && <button type="button" onClick={() => onSelectPlant(catalogMatch)} data-testid={`button-view-match-${i}`} className="focus-ring rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Ver ficha</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  </div>;
}
function InfoLine({ icon, label, text }: { icon: ReactNode; label: string; text: string }) { return <div className="flex gap-3"><span className="mt-0.5 text-[hsl(var(--primary))]">{icon}</span><div><p className="mono text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-sm leading-6">{text}</p></div></div>; }

function LearnView({ quizIndex, quizScore, quizAnswer, quizDone, quizMode, quizTime, quizStreak, quizBestStreak, answer, restart }: { quizIndex: number; quizScore: number; quizAnswer: string | null; quizDone: boolean; quizMode: QuizMode; quizTime: number; quizStreak: number; quizBestStreak: number; answer: (answer: string) => void; restart: (mode?: QuizMode) => void }) {
  return <div className="mx-auto max-w-[1240px] px-5 py-12 lg:px-10 lg:py-16"><div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]"><div className="animate-rise"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Reto de campo ampliado</p><h1 className="display mt-3 text-5xl leading-[1.05]">Mira el bosque con otros ojos.</h1><p className="mt-5 max-w-md text-sm leading-7 text-[hsl(var(--muted-foreground))]">Observa, recuerda y decide. Ahora puedes entrenar con 15 preguntas, racha de aciertos y un modo experto contra el reloj.</p><div className="mt-9 space-y-4"><LearnStat icon={<Compass size={18} />} number={`${plants.length}`} label="especies para explorar" /><LearnStat icon={<MapPin size={18} />} number="4" label="paisajes bolivianos" /><LearnStat icon={<CircleHelp size={18} />} number="15" label="preguntas de campo" /></div><div className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => restart('explorador')} data-testid="button-mode-explorer" className={`rounded-2xl border p-4 text-left transition-all ${quizMode === 'explorador' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}><span className="flex items-center gap-2 text-sm font-bold"><BookOpen size={16} /> Modo explorador</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">15 preguntas a tu ritmo.</span></button><button type="button" onClick={() => restart('experto')} data-testid="button-mode-expert" className={`rounded-2xl border p-4 text-left transition-all ${quizMode === 'experto' ? 'border-[hsl(var(--accent-foreground))] bg-[hsl(var(--accent)/.25)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}><span className="flex items-center gap-2 text-sm font-bold"><Target size={16} /> Modo experto</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">25 segundos y puntos dobles.</span></button></div></div><div className="rounded-[2rem] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-lg)] md:p-10">{quizDone ? <QuizResult score={quizScore} restart={() => restart(quizMode)} mode={quizMode} /> : <QuizCard index={quizIndex} score={quizScore} chosen={quizAnswer} answer={answer} mode={quizMode} time={quizTime} streak={quizStreak} bestStreak={quizBestStreak} />}</div></div><div className="mt-16 border-t border-[hsl(var(--border))] pt-12"><SectionHeading eyebrow="Método de observación" title="Tres pistas para empezar" body="No necesitas saberlo todo para mirar con atención." /><div className="grid gap-5 md:grid-cols-3"><LearnCard icon={<Sun size={21} />} title="Forma" body="Observa las hojas, la corteza, las flores y cómo se organiza cada parte." /><LearnCard icon={<MapPin size={21} />} title="Lugar" body="El hábitat dice mucho: la altura, la humedad y el suelo son pistas esenciales." /><LearnCard icon={<BookOpen size={21} />} title="Memoria" body="Relaciona la especie con una historia, un uso local o una sensación." /></div></div></div>;
}
function LearnStat({ icon, number, label }: { icon: ReactNode; number: string; label: string }) { return <div className="flex items-center gap-4"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--accent)/.25)] text-[hsl(var(--primary))]">{icon}</span><div><span className="display text-2xl">{number}</span><span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">{label}</span></div></div>; }
function QuizCard({ index, score, chosen, answer, mode, time, streak, bestStreak }: { index: number; score: number; chosen: string | null; answer: (v: string) => void; mode: QuizMode; time: number; streak: number; bestStreak: number }) { const question = questions[index]; return <div><div className="flex flex-wrap items-center justify-between gap-3"><span className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">{mode === 'experto' ? 'Reto experto' : 'Quiz de campo'}</span><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary-foreground)/.65)]"><Award size={14} /> Racha {streak}</span>{mode === 'experto' && <span className={`inline-flex items-center gap-1 text-xs ${time <= 8 ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--primary-foreground)/.65)]'}`}><Clock3 size={14} /> {time}s</span>}<span className="mono text-xs text-[hsl(var(--primary-foreground)/.55)]">{String(index + 1).padStart(2, '0')} / {questions.length}</span></div></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-[hsl(var(--primary-foreground)/.15)]"><div className="h-full rounded-full bg-[hsl(var(--accent))] transition-all duration-500" style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div><h2 className="display mt-10 text-3xl leading-tight md:text-4xl">{question.text}</h2><div className="mt-8 grid gap-3">{question.options.map((option, i) => { const correct = chosen !== null && option === question.answer; const wrong = chosen === option && !correct; return <button type="button" key={option} disabled={chosen !== null} onClick={() => answer(option)} data-testid={`quiz-option-${i}`} className={`focus-ring flex items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm transition-all ${correct ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : wrong ? 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/.25)]' : 'border-[hsl(var(--primary-foreground)/.2)] hover:-translate-y-0.5 hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--primary-foreground)/.06)]'}`}><span><span className="mono mr-3 text-[10px] opacity-60">{String.fromCharCode(65 + i)}</span>{option}</span>{correct && <Check size={17} />}</button>; })}</div><div className="mt-7 flex justify-between text-xs text-[hsl(var(--primary-foreground)/.55)]"><span>Puntaje: {score} puntos</span><span>Mejor racha: {bestStreak}</span></div></div>; }
function QuizResult({ score, restart, mode }: { score: number; restart: () => void; mode: QuizMode }) { const maxScore = mode === 'experto' ? questions.length * 2 : questions.length; const ratio = score / maxScore; const message = ratio >= .8 ? 'Tu mirada ya encuentra las pistas importantes.' : ratio >= .5 ? 'Vas construyendo una buena libreta de campo.' : 'Cada error es una nueva especie por conocer.'; return <div className="flex min-h-[500px] flex-col items-center justify-center text-center"><span className="grid size-20 place-items-center rounded-[28px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Trophy size={35} /></span><p className="mono mt-7 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Expedición completada</p><h2 className="display mt-3 text-4xl">Tu resultado: {score} / {maxScore}</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[hsl(var(--primary-foreground)/.7)]">{message}</p><button type="button" onClick={restart} data-testid="button-restart-quiz" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-5 py-3 text-sm font-bold text-[hsl(var(--accent-foreground))]"><RotateCcw size={16} /> Intentarlo de nuevo</button></div>; }
function LearnCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) { return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">{icon}</span><h3 className="display mt-5 text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{body}</p></div>; }

function LaboratoryView({ plants, setSelectedPlant }: { plants: Plant[]; setSelectedPlant: (plant: Plant) => void }) {
  const [firstId, setFirstId] = useState(plants[0]?.id || '');
  const [secondId, setSecondId] = useState(plants[1]?.id || '');
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const first = plants.find((plant) => plant.id === firstId) || plants[0];
  const second = plants.find((plant) => plant.id === secondId) || plants[1];
  const observations = ['Observé la forma de sus hojas', 'Identifiqué su hábitat', 'Encontré un uso o dato curioso'];

  useEffect(() => {
    if (!first) return;
    try {
      const savedNote = JSON.parse(localStorage.getItem(`sbd-lab-${first.id}`) || 'null') as { checked?: string[]; notes?: string } | null;
      setChecked(savedNote?.checked || []);
      setNotes(savedNote?.notes || '');
      setSaved(Boolean(savedNote));
    } catch {
      setChecked([]);
      setNotes('');
      setSaved(false);
    }
  }, [firstId]);

  const saveObservation = () => {
    if (!first) return;
    localStorage.setItem(`sbd-lab-${first.id}`, JSON.stringify({ checked, notes }));
    setSaved(true);
  };

  if (!first || !second) return null;
  return <div className="mx-auto max-w-[1240px] px-5 py-12 lg:px-10 lg:py-16">
    <div className="animate-rise max-w-3xl"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Espacio de investigación</p><h1 className="display mt-3 text-5xl">Laboratorio botánico.</h1><p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Elige una especie, registra tus observaciones y compárala con otra planta de la colección. Cada hallazgo queda guardado en este dispositivo.</p></div>
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <div className="overflow-hidden rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-md)]">
        <div className="relative h-72 bg-[hsl(var(--secondary))] md:h-96"><img src={first.photo} onError={imageFallback} alt={first.commonName} className="size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[hsl(158_26%_12%/.75)] to-transparent" /><div className="absolute bottom-6 left-6 text-white"><span className="mono rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-[9px] uppercase tracking-[.15em] text-[hsl(var(--accent-foreground))]">{first.type}</span><h2 className="display mt-3 text-4xl">{first.commonName}</h2><p className="text-sm italic text-white/75">{first.scientificName}</p></div></div>
        <div className="p-6 md:p-8"><label className="block text-sm font-bold">Planta que vas a investigar<select value={firstId} onChange={(event) => setFirstId(event.target.value)} data-testid="select-lab-plant" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none">{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.commonName} · {plant.scientificName}</option>)}</select></label><div className="mt-6 grid gap-4 sm:grid-cols-2"><InfoLine icon={<Leaf size={15} />} label="Familia" text={first.family} /><InfoLine icon={<MapPin size={15} />} label="Hábitat" text={first.habitat} /></div><button type="button" onClick={() => setSelectedPlant(first)} data-testid="button-lab-open-detail" className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]">Abrir ficha completa <ChevronRight size={16} /></button></div>
      </div>
      <div className="rounded-[2rem] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-md)] md:p-8"><div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Registro de observación</p><h2 className="display mt-2 text-3xl">¿Qué descubriste?</h2></div><span className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--accent)/.22)] text-[hsl(var(--accent))]"><ListChecks size={24} /></span></div><div className="mt-7 space-y-3">{observations.map((observation) => <label key={observation} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--primary-foreground)/.18)] p-3 text-sm transition-colors hover:bg-[hsl(var(--primary-foreground)/.07)]"><input type="checkbox" checked={checked.includes(observation)} onChange={() => setChecked((current) => current.includes(observation) ? current.filter((item) => item !== observation) : [...current, observation])} className="size-4 accent-[hsl(var(--accent))]" />{observation}</label>)}</div><label className="mt-6 block text-sm font-bold">Notas de campo<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Escribe una observación..." data-testid="input-lab-notes" className="focus-ring mt-2 min-h-28 w-full resize-y rounded-xl border border-[hsl(var(--primary-foreground)/.2)] bg-[hsl(var(--primary-foreground)/.08)] p-3 text-sm font-normal outline-none placeholder:text-[hsl(var(--primary-foreground)/.5)]" /></label><div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-[hsl(var(--primary-foreground)/.6)]">{checked.length} de {observations.length} pistas marcadas{saved ? ' · guardado' : ''}</span><button type="button" onClick={saveObservation} data-testid="button-save-lab" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--accent-foreground))]"><Save size={15} /> Guardar</button></div></div>
    </div>
    <section className="mt-12 rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm md:p-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Mesa comparativa</p><h2 className="display mt-2 text-3xl">Encuentra las diferencias.</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Contrasta dos especies usando la información de sus fichas.</p></div><label className="w-full text-sm font-bold md:max-w-xs">Comparar con<select value={secondId} onChange={(event) => setSecondId(event.target.value)} data-testid="select-lab-compare" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none">{plants.filter((plant) => plant.id !== first.id).map((plant) => <option key={plant.id} value={plant.id}>{plant.commonName}</option>)}</select></label></div><div className="mt-7 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-[hsl(var(--border))]"><th className="pb-3 pr-4 text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Pista</th><th className="pb-3 pr-4 font-bold text-[hsl(var(--primary))]">{first.commonName}</th><th className="pb-3 font-bold text-[hsl(var(--primary))]">{second.commonName}</th></tr></thead><tbody>{[['Tipo', first.type, second.type], ['Familia', first.family, second.family], ['Hábitat', first.habitat, second.habitat], ['Cuidado', first.care, second.care]].map(([label, firstValue, secondValue]) => <tr key={label} className="border-b border-[hsl(var(--border)/.65)] align-top"><th className="py-4 pr-4 text-xs font-bold text-[hsl(var(--muted-foreground))]">{label}</th><td className="py-4 pr-4 leading-6">{firstValue}</td><td className="py-4 leading-6">{secondValue}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function AboutView({ navigate, count }: { navigate: (v: View) => void; count: number }) { return <div><section className="bg-[hsl(var(--primary))] px-5 py-20 text-[hsl(var(--primary-foreground))] lg:px-10 lg:py-28"><div className="mx-auto max-w-[1000px]"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Acerca de la biblioteca</p><h1 className="display mt-4 max-w-3xl text-5xl leading-[1.03] md:text-7xl">Una reserva natural, hecha de conocimiento.</h1><p className="mt-7 max-w-xl text-base leading-7 text-[hsl(var(--primary-foreground)/.72)]">Sistema Botánico Digital nace para acercar la diversidad vegetal boliviana a estudiantes, docentes y a cualquier persona que tenga curiosidad por su paisaje.</p></div></section><section className="mx-auto max-w-[1000px] px-5 py-16 lg:px-10"><div className="grid gap-12 md:grid-cols-[1fr_.8fr]"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Nuestra intención</p><h2 className="display mt-3 text-4xl">Mirar cerca para cuidar lejos.</h2><p className="mt-5 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Las plantas no son un fondo quieto. Son alimento, refugio, medicina, memoria y una forma de leer el territorio. Por eso reunimos nombres científicos y saberes cotidianos en una misma experiencia.</p><p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">La colección está pensada como punto de partida para una exposición escolar: puedes explorar por tipo, investigar una especie, guardar tus hallazgos y medir lo aprendido.</p><button type="button" onClick={() => navigate('galeria')} data-testid="button-about-gallery" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">Conocer la colección <ChevronRight size={16} /></button></div><div className="space-y-4"><div className="rounded-[1.5rem] bg-[hsl(var(--secondary))] p-6"><p className="display text-4xl text-[hsl(var(--primary))]">{count}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">especies para descubrir</p></div><div className="rounded-[1.5rem] bg-[hsl(var(--accent)/.2)] p-6"><p className="display text-4xl text-[hsl(var(--primary))]">4</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">paisajes de referencia</p></div><div className="rounded-[1.5rem] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><p className="display text-4xl">1</p><p className="mt-1 text-sm text-[hsl(var(--primary-foreground)/.65)]">curiosidad que puede cambiar tu mirada</p></div></div></div></section></div>; }

function ContactView({ setToast }: { setToast: (message: string) => void }) { const [sent, setSent] = useState(false); const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); setToast('Mensaje preparado. Gracias por escribirnos.'); }; return <div className="mx-auto max-w-[1000px] px-5 py-12 lg:px-10 lg:py-16"><div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div className="animate-rise"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Cuaderno abierto</p><h1 className="display mt-3 text-5xl">Conversemos sobre plantas.</h1><p className="mt-5 text-sm leading-7 text-[hsl(var(--muted-foreground))]">¿Tienes una sugerencia para la colección o una historia de tu comunidad? Escríbenos y deja una nueva semilla en este proyecto.</p><div className="mt-8 space-y-4 text-sm"><p className="flex items-center gap-3"><Mail size={17} className="text-[hsl(var(--primary))]" /> hola@sistemabotanico.bo</p><p className="flex items-center gap-3"><MapPin size={17} className="text-[hsl(var(--primary))]" /> Cochabamba, Bolivia</p></div></div><form onSubmit={submit} className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-md)] md:p-8">{sent ? <div className="flex min-h-[370px] flex-col items-center justify-center text-center"><span className="grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Check size={26} /></span><h2 className="display mt-5 text-3xl">Gracias por tu mensaje.</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Lo recibimos con mucha atención.</p><button type="button" onClick={() => setSent(false)} data-testid="button-send-another" className="mt-6 text-sm font-bold text-[hsl(var(--primary))]">Enviar otro mensaje</button></div> : <><div className="grid gap-4 sm:grid-cols-2"><Field label="Tu nombre" name="name" placeholder="Cómo te llamas" /><Field label="Tu correo" name="email" type="email" placeholder="nombre@correo.com" /></div><label className="mt-5 block text-sm font-bold">Mensaje<textarea required name="message" data-testid="input-message" placeholder="Cuéntanos qué descubriste..." className="focus-ring mt-2 min-h-36 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></label><button type="submit" data-testid="button-submit-contact" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">Enviar mensaje <Send size={16} /></button></>}</form></div></div>; }
function Field({ label, name, type = 'text', placeholder }: { label: string; name: string; type?: string; placeholder: string }) { return <label className="block text-sm font-bold">{label}<input required type={type} name={name} placeholder={placeholder} data-testid={`input-${name}`} className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></label>; }

function EnhancedAuthDialog({ mode, setMode, close, onSuccess }: { mode: 'login' | 'register'; setMode: (mode: 'login' | 'register') => void; close: () => void; onSuccess: (user: User) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const users = loadUsers();
    if (mode === 'register') {
      if (users.some((user) => user.email === normalizedEmail)) {
        setError('Este correo ya tiene una cuenta.');
        return;
      }
      const user: User = { name: name.trim() || 'Explorador', email: normalizedEmail, password, institution: institution.trim(), course: course.trim(), city: city.trim() };
      localStorage.setItem('sbd-users', JSON.stringify([...users, user]));
      localStorage.setItem('sbd-session', user.email);
      onSuccess(user);
      return;
    }
    const user = users.find((item) => item.email === normalizedEmail && item.password === password);
    if (!user) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    localStorage.setItem('sbd-session', user.email);
    onSuccess(user);
  };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[hsl(158_26%_12%/.7)] p-5 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="dialog-auth"><div className="relative my-4 w-full max-w-lg rounded-[2rem] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-lg)] md:p-9"><button type="button" onClick={close} aria-label="Cerrar acceso" data-testid="button-close-auth" className="focus-ring absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-[hsl(var(--muted))]"><X size={17} /></button><span className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">{mode === 'login' ? <LockKeyhole size={22} /> : <UserPlus size={22} />}</span><p className="mono mt-6 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{mode === 'login' ? 'Volver al cuaderno' : 'Crear perfil de estudiante'}</p><h2 className="display mt-2 text-3xl">{mode === 'login' ? 'Ingresa a tu biblioteca' : 'Crea tu espacio personal'}</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Tus favoritas, notas y avances te estarán esperando.' : 'Tus datos se guardan en este dispositivo y podrás editarlos desde Mi perfil.'}</p><form onSubmit={submit} className="mt-7 space-y-4">{mode === 'register' && <><label className="block text-sm font-bold">Nombre completo<input required value={name} onChange={(event) => setName(event.target.value)} data-testid="input-auth-name" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Unidad educativa<input value={institution} onChange={(event) => setInstitution(event.target.value)} data-testid="input-auth-institution" placeholder="Nombre de tu colegio" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></label><label className="block text-sm font-bold">Curso<input value={course} onChange={(event) => setCourse(event.target.value)} data-testid="input-auth-course" placeholder="Ej. 5to A" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></label></div><label className="block text-sm font-bold">Ciudad<input value={city} onChange={(event) => setCity(event.target.value)} data-testid="input-auth-city" placeholder="Cochabamba" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></label></>}<label className="block text-sm font-bold">Correo electrónico<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} data-testid="input-auth-email" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label><label className="block text-sm font-bold">Contraseña<input required minLength={4} type="password" value={password} onChange={(event) => setPassword(event.target.value)} data-testid="input-auth-password" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label>{error && <p role="alert" data-testid="status-auth-error" className="rounded-xl bg-[hsl(var(--destructive)/.1)] p-3 text-xs text-[hsl(var(--destructive))]">{error}</p>}<button type="submit" data-testid="button-submit-auth" className="w-full rounded-full bg-[hsl(var(--primary))] py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button></form><button type="button" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }} data-testid="button-toggle-auth-mode" className="mt-5 w-full text-center text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]">{mode === 'login' ? '¿Aún no tienes cuenta? Crear una' : '¿Ya tienes cuenta? Ingresar'}</button></div></div>;
}

function ProfileDialog({ user, close, onSaved, signOut }: { user: User; close: () => void; onSaved: (user: User) => void; signOut: () => void }) {
  const [name, setName] = useState(user.name);
  const [institution, setInstitution] = useState(user.institution || '');
  const [course, setCourse] = useState(user.course || '');
  const [city, setCity] = useState(user.city || '');
  const save = (event: FormEvent) => {
    event.preventDefault();
    const updated: User = { ...user, name: name.trim() || user.name, institution: institution.trim(), course: course.trim(), city: city.trim() };
    const users = loadUsers().map((item) => item.email === user.email ? updated : item);
    localStorage.setItem('sbd-users', JSON.stringify(users));
    onSaved(updated);
  };
  return <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-[hsl(158_26%_12%/.7)] p-5 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="dialog-profile"><form onSubmit={save} className="relative my-4 w-full max-w-lg rounded-[2rem] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-lg)] md:p-9"><button type="button" onClick={close} aria-label="Cerrar perfil" data-testid="button-close-profile" className="focus-ring absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-[hsl(var(--muted))]"><X size={17} /></button><span className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><UserRound size={22} /></span><p className="mono mt-6 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Mi espacio personal</p><h2 className="display mt-2 text-3xl">Mis datos</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Actualiza tu información para personalizar tu cuaderno de campo.</p><div className="mt-7 space-y-4"><label className="block text-sm font-bold">Nombre completo<input required value={name} onChange={(event) => setName(event.target.value)} data-testid="input-profile-name" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label><label className="block text-sm font-bold">Correo electrónico<input value={user.email} readOnly data-testid="input-profile-email" className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-sm font-normal text-[hsl(var(--muted-foreground))] outline-none" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Unidad educativa<input value={institution} onChange={(event) => setInstitution(event.target.value)} data-testid="input-profile-institution" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label><label className="block text-sm font-bold">Curso<input value={course} onChange={(event) => setCourse(event.target.value)} data-testid="input-profile-course" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label></div><label className="block text-sm font-bold">Ciudad<input value={city} onChange={(event) => setCity(event.target.value)} data-testid="input-profile-city" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label></div><div className="mt-7 flex flex-wrap justify-between gap-3"><button type="button" onClick={signOut} data-testid="button-profile-logout" className="text-sm font-bold text-[hsl(var(--destructive))]">Cerrar sesión</button><button type="submit" data-testid="button-save-profile" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Save size={16} /> Guardar datos</button></div></form></div>;
}

function AuthDialog({ mode, setMode, close, onSuccess }: { mode: 'login' | 'register'; setMode: (m: 'login' | 'register') => void; close: () => void; onSuccess: (user: User) => void }) { const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const submit = (event: FormEvent) => { event.preventDefault(); const users = loadUsers(); if (mode === 'register') { if (users.some((user) => user.email === email.trim().toLowerCase())) { setError('Este correo ya tiene una cuenta.'); return; } const user = { name: name.trim() || 'Explorador', email: email.trim().toLowerCase(), password }; localStorage.setItem('sbd-users', JSON.stringify([...users, user])); localStorage.setItem('sbd-session', user.email); onSuccess(user); } else { const user = users.find((item) => item.email === email.trim().toLowerCase() && item.password === password); if (!user) { setError('Correo o contraseña incorrectos.'); return; } localStorage.setItem('sbd-session', user.email); onSuccess(user); } }; return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[hsl(158_26%_12%/.7)] p-5 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="dialog-auth"><div className="relative w-full max-w-md rounded-[2rem] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-lg)] md:p-9"><button type="button" onClick={close} aria-label="Cerrar acceso" data-testid="button-close-auth" className="focus-ring absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-[hsl(var(--muted))]"><X size={17} /></button><span className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">{mode === 'login' ? <LockKeyhole size={22} /> : <UserPlus size={22} />}</span><p className="mono mt-6 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{mode === 'login' ? 'Volver al cuaderno' : 'Nueva exploradora'}</p><h2 className="display mt-2 text-3xl">{mode === 'login' ? 'Ingresa a tu biblioteca' : 'Crea tu espacio personal'}</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Tus favoritas te estarán esperando.' : 'Guarda hallazgos y sigue aprendiendo.'}</p><form onSubmit={submit} className="mt-7 space-y-4">{mode === 'register' && <label className="block text-sm font-bold">Nombre<input required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-auth-name" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label>}<label className="block text-sm font-bold">Correo electrónico<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-auth-email" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label><label className="block text-sm font-bold">Contraseña<input required minLength={4} type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-auth-password" className="focus-ring mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm font-normal outline-none" /></label>{error && <p role="alert" data-testid="status-auth-error" className="rounded-xl bg-[hsl(var(--destructive)/.1)] p-3 text-xs text-[hsl(var(--destructive))]">{error}</p>}<button type="submit" data-testid="button-submit-auth" className="w-full rounded-full bg-[hsl(var(--primary))] py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button></form><button type="button" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }} data-testid="button-toggle-auth-mode" className="mt-5 w-full text-center text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]">{mode === 'login' ? '¿Aún no tienes cuenta? Crear una' : '¿Ya tienes cuenta? Ingresar'}</button></div></div>; }

function App() { return <QueryClientProvider client={queryClient}><ErrorBoundary><AppContent /></ErrorBoundary><Toaster /></QueryClientProvider>; }

export default App;