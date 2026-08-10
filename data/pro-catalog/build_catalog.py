# -*- coding: utf-8 -*-
"""
Générateur du catalogue de prestations PRO (comptes professionnels).
Sortie : taxonomie 3 niveaux (catégorie > sous-catégorie > sous-sous-catégorie)
+ champs dynamiques + règles de cohérence domaine d'activité <-> annonce.
"""
import json, re, unicodedata, datetime, itertools, os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- utilitaires
def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)

STOP = set("de du des la le les et en a au aux pour par sur avec sans un une l d en".split())
def keywords(*parts):
    toks = []
    for p in parts:
        for t in re.split(r"[^a-zA-Zà-öø-ÿ0-9]+", p.lower()):
            t = t.strip()
            if len(t) > 2 and t not in STOP and t not in toks:
                toks.append(t)
    return toks[:14]

# ------------------------------------------------------- champs dynamiques
FIELDS = [
 ("lieu_prestation","Lieu de la prestation","select",["Chez le client","Dans mon local / atelier","En ligne (visio)","En extérieur","Chez le client ou dans mon local"]),
 ("zone_intervention","Zone d'intervention (villes / codes postaux)","zone",None),
 ("rayon_km","Rayon de déplacement (km)","number",None),
 ("frais_deplacement","Frais de déplacement","select",["Inclus","En supplément","Gratuit sous X km"]),
 ("tarif_type","Type de tarification","select",["Horaire","Forfait","Au m²","Par jour","Par personne","Sur devis","Abonnement mensuel","Au kilomètre","À la course"]),
 ("prix","Prix / à partir de","price",None),
 ("tva","TVA applicable","select",["TVA non applicable (art. 293B)","TVA 20%","TVA 10%","TVA 5,5%"]),
 ("acompte","Acompte demandé","percent",None),
 ("duree","Durée estimée de la prestation","duration",None),
 ("delai_intervention","Délai d'intervention","select",["Urgence (< 2h)","Sous 24h","Sous 48h","Sous 7 jours","Sur planning"]),
 ("disponibilites","Disponibilités / créneaux","schedule",None),
 ("urgence_24_7","Intervention d'urgence 24h/7j","boolean",None),
 ("clientele","Clientèle acceptée","multiselect",["Particuliers","Professionnels","Collectivités","Associations","Copropriétés"]),
 ("nb_intervenants","Nombre d'intervenants","number",None),
 ("materiel_fourni","Matériel / produits fournis","select",["Fournis par le pro","Fournis par le client","À définir"]),
 ("assurance_rc_pro","Assurance RC Pro","document",None),
 ("garantie_decennale","Garantie décennale","document",None),
 ("agrement_sap","Agrément Service à la Personne (crédit d'impôt 50%)","document",None),
 ("diplome","Diplôme / certification","multiselect",None),
 ("experience","Années d'expérience","number",None),
 ("portfolio","Photos de réalisations / portfolio","media",None),
 ("langues_parlees","Langues parlées","multiselect",["Français","Anglais","Espagnol","Arabe","Portugais","Italien","Allemand","Turc","Chinois"]),
 ("ecoresponsable","Produits / démarche écoresponsable","boolean",None),
 # habitat / travaux
 ("surface_m2","Surface concernée (m²)","number",None),
 ("nb_pieces","Nombre de pièces","number",None),
 ("type_logement","Type de logement","select",["Appartement","Maison","Studio","Local commercial","Bureau","Immeuble","Terrain"]),
 ("etage_ascenseur","Étage / ascenseur","text",None),
 ("fourniture_incluse","Fournitures incluses dans le prix","boolean",None),
 ("evacuation_dechets","Évacuation des déchets / déchetterie","boolean",None),
 # événementiel
 ("type_evenement","Type d'événement","select",["Mariage","Anniversaire","Baptême","Séminaire d'entreprise","Soirée privée","Salon / stand","Concert","Festival","Enterrement de vie","Autre"]),
 ("nb_invites","Nombre de personnes","number",None),
 ("date_evenement","Date de l'événement","date",None),
 ("duree_prestation_h","Durée de présence (heures)","number",None),
 # cours / formation
 ("niveau_scolaire","Niveau","multiselect",["Primaire","Collège","Seconde","Première","Terminale","Prépa","Licence","Master","Adulte / reconversion"]),
 ("format_cours","Format","select",["Individuel","En petit groupe","Collectif","En ligne","Hybride"]),
 ("langue_enseignee","Langue enseignée","select",None),
 ("certif_preparee","Certification préparée","select",["Aucune","TOEIC","TOEFL","IELTS","DELF/DALF","Cambridge","CPF éligible","Autre"]),
 ("eligible_cpf","Éligible CPF","boolean",None),
 # personnes
 ("age_public","Âge du public","select",["0-3 ans","3-6 ans","6-11 ans","12-17 ans","Adultes","Seniors","Tous publics"]),
 ("genre_clientele","Clientèle","select",["Femmes","Hommes","Mixte","Enfants"]),
 ("gestes_medicaux","Actes soumis à prescription","boolean",None),
 ("numero_adeli_rpps","Numéro ADELI / RPPS","text",None),
 # beauté
 ("longueur_cheveux","Longueur de cheveux","select",["Courts","Mi-longs","Longs","Très longs"]),
 ("type_cheveux","Type de cheveux","select",["Lisses","Ondulés","Bouclés","Crépus","Colorés","Défrisés"]),
 ("type_peau","Type de peau","select",["Normale","Sèche","Grasse","Mixte","Sensible","Mature"]),
 ("marques_produits","Marques / produits utilisés","text",None),
 # animaux
 ("espece_animal","Espèce","multiselect",["Chien","Chat","NAC","Cheval","Oiseau","Rongeur","Reptile"]),
 ("taille_animal","Gabarit","select",["Très petit","Petit","Moyen","Grand","Très grand"]),
 ("nb_animaux","Nombre d'animaux","number",None),
 ("capacite_animaux","Capacité d'accueil","number",None),
 # véhicules / transport
 ("type_vehicule","Type de véhicule","select",["Citadine","Berline","SUV","Utilitaire","Van","Moto","Scooter","Vélo","Poids lourd","Camping-car"]),
 ("marque_modele","Marque et modèle","text",None),
 ("kilometrage","Kilométrage","number",None),
 ("capacite_passagers","Nombre de passagers","number",None),
 ("volume_m3","Volume à transporter (m³)","number",None),
 ("distance_km","Distance estimée (km)","number",None),
 ("licence_transport","Licence VTC / capacité de transport","document",None),
 # digital
 ("technologies","Technologies / outils","multiselect",None),
 ("type_livrable","Livrables","multiselect",["Maquette","Code source","Fichiers sources","Rapport","Formation","Hébergement","Maintenance"]),
 ("delai_livraison","Délai de livraison","select",["24h","3 jours","1 semaine","2 semaines","1 mois","Plus d'un mois"]),
 ("budget_projet","Budget du projet","range",None),
 ("revisions_incluses","Nombre de révisions incluses","number",None),
 ("type_appareil","Type d'appareil","select",["PC portable","PC fixe","Mac","Smartphone","Tablette","Console","Imprimante","Serveur","Objet connecté"]),
 # immo / juridique
 ("type_bien","Type de bien","select",["Appartement","Maison","Local commercial","Bureau","Terrain","Immeuble","Parking"]),
 ("surface_terrain","Surface du terrain (m²)","number",None),
 ("type_contrat","Type de contrat / document","select",None),
 ("confidentialite","Accord de confidentialité (NDA)","boolean",None),
 # restauration
 ("type_cuisine","Type de cuisine","multiselect",["Française","Italienne","Japonaise","Libanaise","Marocaine","Indienne","Végétarienne","Vegan","Sans gluten","Halal","Casher","Fusion"]),
 ("allergenes","Allergènes gérés","multiselect",["Gluten","Lactose","Arachides","Fruits à coque","Œufs","Poisson","Crustacés","Soja"]),
 ("service_inclus","Service en salle inclus","boolean",None),
 # sport
 ("discipline","Discipline","select",None),
 ("materiel_sport","Matériel fourni","boolean",None),
 ("objectif","Objectif visé","multiselect",["Perte de poids","Prise de masse","Remise en forme","Préparation compétition","Rééducation","Bien-être","Souplesse"]),
]
FIELD_INDEX = {f[0]: {"id": f[0], "label": f[1], "type": f[2], "options": f[3]} for f in FIELDS}

BASE_FIELDS = ["lieu_prestation","zone_intervention","tarif_type","prix","duree","disponibilites",
               "clientele","delai_intervention","assurance_rc_pro","experience","portfolio","tva"]

# ------------------------------------------------------------ le catalogue
# Format : "Catégorie": {icon, domain, variants[], fields[], subs{ "Sous-cat": "feuille|feuille|..." }}
C = {}

C["Beauté & Esthétique"] = dict(icon="sparkles", domain="beaute",
 variants=["à domicile","en salon","pour mariage","forfait découverte","en abonnement","à partir de 2 personnes"],
 fields=["genre_clientele","type_peau","marques_produits","materiel_fourni","diplome","ecoresponsable"],
 subs={
 "Coiffure femme":"Coupe femme|Brushing|Coloration|Balayage|Mèches|Ombré hair|Patine|Permanente|Lissage brésilien|Lissage japonais|Défrisage|Chignon de mariée|Coiffure de soirée|Soin profond kératine|Extensions à chaud|Extensions à froid|Coupe enfant fille|Frange|Botox capillaire|Coupe + couleur + brushing",
 "Coiffure homme & barbier":"Coupe homme|Dégradé américain|Coupe à la tondeuse|Taille de barbe|Rasage traditionnel au coupe-chou|Contour de barbe|Coloration barbe|Soin du visage barbier|Coupe enfant garçon|Coupe + barbe|Entretien de barbe mensuel|Rasage de crâne",
 "Coiffure afro & texturée":"Tresses collées|Box braids|Vanilles|Twists|Locks (démarrage)|Entretien de locks|Tissage|Perruque sur mesure|Pose de closure|Défrisage cheveux crépus|Soin hydratation cheveux crépus|Coiffure enfant afro|Nattes africaines|Crochet braids",
 "Onglerie & manucure":"Manucure classique|Manucure russe|Pose de gel|Pose de capsules|Pose américaine|Vernis semi-permanent|Remplissage gel|Nail art|Dépose de gel|Pédicure esthétique|Beauté des pieds|French manucure|Baby boomer|Renforcement d'ongles|Soin des cuticules",
 "Épilation":"Épilation à la cire jambes|Épilation maillot|Épilation aisselles|Épilation sourcils|Épilation lèvre supérieure|Épilation dos homme|Épilation torse|Épilation intégrale|Épilation au fil|Épilation orientale au sucre|Épilation laser|Épilation lumière pulsée|Forfait épilation complète",
 "Soins du visage":"Nettoyage de peau|Soin hydratant|Soin anti-âge|Peeling doux|Microneedling|Radiofréquence visage|Soin éclat du teint|Extraction de comédons|Masque LED|Soin homme|Soin bio|Diagnostic de peau",
 "Cils & sourcils":"Extensions de cils cil à cil|Volume russe|Rehaussement de cils|Teinture de cils|Dépose d'extensions|Restructuration de sourcils|Teinture de sourcils|Brow lift|Henné sourcils|Microblading|Maquillage permanent sourcils|Remplissage extensions",
 "Maquillage":"Maquillage de jour|Maquillage de soirée|Maquillage mariée|Essai maquillage mariée|Maquillage artistique|Maquillage enfant|Maquillage effets spéciaux|Cours d'auto-maquillage|Maquillage photo/shooting|Maquillage cortège",
 "Soins du corps & minceur":"Gommage corps|Enveloppement|Palper-rouler|Cryolipolyse|Pressothérapie|Drainage lymphatique|LPG endermologie|Soin raffermissant|Bronzage sans soleil|Cavitation|Soin jambes lourdes",
 "Tatouage & piercing":"Tatouage petit format|Tatouage moyen format|Tatouage grande pièce|Flash tattoo|Recouvrement de tatouage|Retouche de tatouage|Détatouage laser|Piercing lobe|Piercing hélix|Piercing nez|Piercing nombril|Piercing langue|Changement de bijou",
 "Prothésie & dentaire esthétique":"Blanchiment dentaire cosmétique|Pose de bijou dentaire|Prothèse ongulaire réparatrice|Prothèse capillaire|Pose de perruque médicale",
 })

C["Bien-être & Massage"] = dict(icon="lotus", domain="bienetre",
 variants=["à domicile","en cabinet","en entreprise","forfait 5 séances","en duo","en visio"],
 fields=["duree_prestation_h","materiel_fourni","diplome","objectif","ecoresponsable"],
 subs={
 "Massages bien-être":"Massage suédois|Massage californien|Massage deep tissue|Massage thaï|Massage ayurvédique|Massage balinais|Massage aux pierres chaudes|Massage lomi-lomi|Massage shiatsu|Massage assis amma|Massage femme enceinte|Massage bébé|Massage sportif|Massage crânien|Réflexologie plantaire|Massage duo|Massage des mains",
 "Spa & hammam":"Gommage au savon noir|Rituel hammam|Soin spa complet|Bain nordique|Sauna privatif|Balnéothérapie|Rituel oriental|Spa mobile événementiel",
 "Sophrologie & relaxation":"Séance de sophrologie|Gestion du stress|Préparation à l'accouchement|Préparation aux examens|Sommeil et insomnie|Séance de relaxation guidée|Cohérence cardiaque|Méditation pleine conscience|Atelier respiration",
 "Hypnose & thérapies brèves":"Hypnose arrêt du tabac|Hypnose perte de poids|Hypnose phobies|Hypnose confiance en soi|Hypnose gestion de la douleur|EMDR|PNL|Thérapie brève systémique|Hypnose sommeil",
 "Énergétique & alternatif":"Reiki|Magnétisme|Lithothérapie|Access bars|Soin énergétique|Kinésiologie|Auriculothérapie|Chromothérapie|Aromathérapie|Naturopathie|Phytothérapie|Bilan de vitalité",
 "Yoga & méditation":"Hatha yoga|Vinyasa yoga|Yin yoga|Ashtanga|Yoga prénatal|Yoga enfants|Yoga du rire|Yoga sur chaise entreprise|Retraite yoga|Méditation guidée|Pranayama|Yoga nidra",
 })

C["Santé & Paramédical"] = dict(icon="heart-pulse", domain="sante",
 variants=["à domicile","au cabinet","en téléconsultation","en EHPAD","en entreprise"],
 fields=["diplome","numero_adeli_rpps","gestes_medicaux","age_public","agrement_sap"],
 subs={
 "Soins infirmiers":"Prise de sang à domicile|Injection|Pansement simple|Pansement complexe|Perfusion|Soins post-opératoires|Surveillance de traitement|Pose de sonde|Soins de stomie|Toilette médicalisée|Test antigénique|Vaccination",
 "Kinésithérapie":"Rééducation post-opératoire|Rééducation du genou|Rééducation de l'épaule|Kiné respiratoire|Kiné du sport|Rééducation périnéale|Drainage lymphatique médical|Kiné pédiatrique|Rééducation vestibulaire|Massage thérapeutique|Rééducation lombaire",
 "Ostéopathie & chiropraxie":"Consultation ostéopathie adulte|Ostéopathie nourrisson|Ostéopathie femme enceinte|Ostéopathie du sport|Ostéopathie crânienne|Ajustement chiropratique|Bilan postural|Étiopathie",
 "Podologie & pédicurie":"Soin de pédicurie médicale|Semelles orthopédiques|Traitement ongle incarné|Traitement verrue plantaire|Bilan podologique|Podologie du sport|Soin du pied diabétique",
 "Psychologie & psychothérapie":"Consultation psychologue|Thérapie cognitivo-comportementale|Thérapie de couple|Thérapie familiale|Psychologue enfant|Psychologue adolescent|Bilan psychologique|Accompagnement du deuil|Gestion de l'anxiété|Burn-out et travail|Psychotraumatologie",
 "Orthophonie & orthoptie":"Bilan orthophonique|Rééducation du langage oral|Rééducation dyslexie|Rééducation bégaiement|Rééducation post-AVC|Bilan orthoptique|Rééducation orthoptique|Dépistage des troubles dys",
 "Nutrition & diététique":"Bilan diététique|Programme perte de poids|Nutrition sportive|Rééquilibrage alimentaire|Diététique diabète|Diététique grossesse|Nutrition enfant|Régime sans gluten|Suivi mensuel diététique|Atelier nutrition entreprise",
 "Sage-femme & périnatalité":"Suivi de grossesse|Préparation à la naissance|Rééducation périnéale sage-femme|Consultation allaitement|Monitoring à domicile|Accompagnement post-partum|Doula|Massage bébé parents",
 "Optique & audition":"Test de vue|Adaptation de lentilles|Réparation de lunettes|Bilan auditif|Appareillage auditif|Nettoyage d'appareil auditif|Protection auditive sur mesure",
 })

C["Sport & Coaching sportif"] = dict(icon="dumbbell", domain="sport",
 variants=["à domicile","en salle","en extérieur","en visio","en petit groupe","forfait 10 séances"],
 fields=["discipline","objectif","materiel_sport","age_public","format_cours","diplome"],
 subs={
 "Coaching personnel":"Coach sportif personnel|Remise en forme|Perte de poids|Prise de masse|Renforcement musculaire|HIIT|Cross training|Préparation physique générale|Coaching post-partum|Coaching senior|Coaching adolescent|Programme d'entraînement à distance|Bilan de forme",
 "Fitness collectif":"Cours de fitness collectif|Body pump|Zumba|Step|Aquagym|Aquabike|Circuit training|Bootcamp extérieur|Stretching|Pilates|Cours de Pilates reformer|Gym douce",
 "Sports de combat":"Cours de boxe anglaise|Boxe française|Boxe thaï|MMA|Krav maga|Self-défense|Judo|Karaté|Taekwondo|Jiu-jitsu brésilien|Lutte|Kickboxing|Self-défense femmes",
 "Sports aquatiques":"Cours de natation enfant|Cours de natation adulte|Perfectionnement crawl|Aquaphobie|Plongée sous-marine|Apnée|Surf|Paddle|Kitesurf|Voile|Wakeboard|Sauvetage aquatique",
 "Sports de raquette & collectifs":"Cours de tennis|Cours de padel|Badminton|Tennis de table|Squash|Cours de football|Basket|Volley|Handball|Rugby|Coaching gardien de but",
 "Sports d'extérieur & nature":"Randonnée accompagnée|Trail coaching|Course à pied|Préparation marathon|Vélo de route|VTT|Escalade|Via ferrata|Canyoning|Ski|Snowboard|Équitation|Golf|Parapente|Accrobranche",
 "Danse":"Danse classique|Modern jazz|Hip-hop|Danse contemporaine|Salsa|Bachata|Kizomba|Tango argentin|Rock'n'roll|Danse de salon|Danse orientale|Afro dance|Danse country|Ouverture de bal mariage|Chorégraphie sur mesure|Pole dance|Twerk|Breakdance",
 "Préparation & récupération":"Préparation mentale|Préparation physique compétition|Analyse de la foulée|Test VMA|Étirements assistés|Cryothérapie|Électrostimulation|Bilan de composition corporelle",
 })

C["Garde d'enfants & Famille"] = dict(icon="baby", domain="famille",
 variants=["à domicile","en sortie d'école","en garde partagée","en périscolaire","le week-end","en horaires décalés"],
 fields=["age_public","agrement_sap","nb_personnes","diplome","langues_parlees","permis_vehicule" ],
 subs={
 "Garde d'enfants":"Baby-sitting ponctuel|Garde régulière à domicile|Garde d'enfants de moins de 3 ans|Sortie de crèche|Sortie d'école|Garde partagée|Garde de nuit|Garde le week-end|Garde pendant les vacances|Garde d'urgence|Nounou à temps plein|Garde d'enfant en situation de handicap|Accompagnement aux activités",
 "Aide aux devoirs & périscolaire":"Aide aux devoirs primaire|Aide aux devoirs collège|Aide aux devoirs lycée|Méthodologie de travail|Accompagnement DYS|Atelier lecture|Atelier d'écriture|Accompagnement décrochage scolaire",
 "Animation & activités enfants":"Animation d'anniversaire|Atelier créatif enfants|Atelier cuisine enfants|Éveil musical|Éveil corporel|Atelier scientifique|Atelier théâtre enfants|Stage vacances|Clown/spectacle enfants|Chasse au trésor|Atelier robotique",
 "Soutien à la parentalité":"Consultation en parentalité|Accompagnement au sommeil de l'enfant|Coaching de la diversification alimentaire|Atelier portage|Préparation à l'arrivée d'un bébé|Médiation familiale|Accompagnement séparation|Conseil en éducation positive",
 "Aide aux tâches familiales":"Préparation des repas enfants|Aide au bain et coucher|Transport école-domicile|Accompagnement rendez-vous médicaux|Organisation de la maison familiale|Gestion du linge enfants",
 })

C["Aide aux seniors & Handicap"] = dict(icon="accessibility", domain="aide_personne",
 variants=["à domicile","en résidence","en EHPAD","le week-end","de nuit","en relais d'aidant"],
 fields=["agrement_sap","age_public","diplome","gestes_medicaux","nb_intervenants"],
 subs={
 "Aide à la vie quotidienne":"Aide au lever et au coucher|Aide à la toilette|Aide à l'habillage|Aide à la prise des repas|Préparation des repas adaptés|Aide aux courses|Entretien du logement senior|Aide au change|Transfert et mobilisation|Aide à la mobilité intérieure",
 "Accompagnement & compagnie":"Compagnie et conversation|Accompagnement promenade|Accompagnement aux courses|Accompagnement rendez-vous médicaux|Accompagnement sorties culturelles|Lecture à voix haute|Jeux et stimulation cognitive|Visite de convivialité|Accompagnement vacances",
 "Garde & présence":"Garde de nuit|Garde de jour|Présence continue 24h|Relais d'aidant familial|Veille de sécurité|Accompagnement en fin de vie|Garde après hospitalisation",
 "Handicap & dépendance":"Auxiliaire de vie handicap|Accompagnement autisme|Accompagnement Alzheimer|Accompagnement Parkinson|Aide à la communication (LSF)|Transport adapté PMR|Aide à la scolarité d'un enfant handicapé|Accompagnement en milieu professionnel",
 "Adaptation du logement":"Diagnostic d'accessibilité|Installation de barres d'appui|Monte-escalier|Aménagement salle de bain PMR|Élargissement de portes|Domotique pour senior|Téléassistance|Détecteur de chute",
 })

C["Ménage & Entretien du domicile"] = dict(icon="broom", domain="menage",
 variants=["ponctuel","hebdomadaire","mensuel","après travaux","avant état des lieux","produits écologiques"],
 fields=["surface_m2","nb_pieces","type_logement","materiel_fourni","agrement_sap","ecoresponsable","evacuation_dechets"],
 subs={
 "Ménage courant":"Ménage complet du logement|Ménage de la cuisine|Ménage salle de bain|Dépoussiérage|Aspiration et lavage des sols|Ménage hebdomadaire|Grand ménage de printemps|Ménage après réception|Ménage de fin de bail|Ménage location saisonnière|Ménage de résidence secondaire",
 "Repassage & linge":"Repassage à domicile|Repassage en atelier|Lavage et repassage|Pliage et rangement du linge|Retouches simples|Entretien du linge de maison|Blanchisserie collecte et livraison",
 "Nettoyage spécialisé":"Nettoyage de vitres|Nettoyage de vérandas|Nettoyage de moquette|Shampoing canapé|Nettoyage de matelas|Nettoyage de four|Nettoyage de hotte|Détartrage sanitaire|Nettoyage après sinistre|Nettoyage après décès|Nettoyage syndrome de Diogène|Désinfection virucide|Nettoyage cryogénique",
 "Débarras & rangement":"Débarras d'appartement|Débarras de cave|Débarras de garage|Débarras de grenier|Vide-maison|Home organising|Rangement de dressing|Tri et désencombrement|Évacuation en déchetterie|Débarras avec revente",
 "Nettoyage extérieur du domicile":"Nettoyage de terrasse|Nettoyage haute pression|Démoussage de toiture|Nettoyage de façade|Nettoyage d'allée|Nettoyage de gouttières|Nettoyage de piscine|Nettoyage de portail",
 })

C["Nettoyage professionnel & Entreprises"] = dict(icon="building-2", domain="proprete",
 variants=["contrat annuel","prestation ponctuelle","en horaires décalés","le week-end","en urgence"],
 fields=["surface_m2","nb_intervenants","materiel_fourni","clientele","ecoresponsable"],
 subs={
 "Nettoyage de locaux":"Nettoyage de bureaux|Nettoyage de commerces|Nettoyage de restaurants|Nettoyage de cabinets médicaux|Nettoyage de salles de sport|Nettoyage d'écoles|Nettoyage d'entrepôts|Nettoyage de showroom|Remise en état de locaux",
 "Nettoyage industriel & technique":"Nettoyage industriel|Nettoyage de machines|Nettoyage de cuves|Nettoyage de silos|Dégraissage de cuisine professionnelle|Nettoyage de conduits de ventilation|Nettoyage cryogénique industriel|Décapage de sols|Cristallisation de marbre",
 "Copropriété & immeubles":"Entretien de parties communes|Sortie et rentrée des poubelles|Nettoyage de parking souterrain|Nettoyage de cages d'escalier|Gardiennage d'immeuble|Entretien de local poubelles|Nettoyage de local vélo",
 "Vitrerie & travaux en hauteur":"Nettoyage de vitres en hauteur|Travaux sur corde|Nettoyage de verrière|Nettoyage de façade vitrée|Nettoyage de panneaux solaires|Nettoyage de bardage",
 "Hygiène & 3D":"Dératisation|Désinsectisation|Désinfection|Traitement punaises de lit|Traitement cafards|Destruction de nid de guêpes|Traitement des termites|Traitement anti-mérule|Éloignement des pigeons|Contrat de lutte antiparasitaire",
 })

C["Travaux & Rénovation"] = dict(icon="hammer", domain="btp",
 variants=["devis gratuit","sur mesure","avec fourniture","main d'œuvre seule","rénovation complète","urgence"],
 fields=["surface_m2","type_logement","fourniture_incluse","garantie_decennale","evacuation_dechets","nb_intervenants"],
 subs={
 "Plomberie":"Installation de robinetterie|Remplacement de chauffe-eau|Installation de douche|Installation de baignoire|Recherche de fuite|Réparation de fuite|Débouchage de canalisation|Remplacement de WC|Installation de lave-linge|Création de réseau d'eau|Mise aux normes plomberie|Détartrage de chauffe-eau|Pose de adoucisseur d'eau",
 "Électricité":"Mise aux normes électriques|Remplacement de tableau électrique|Création de prises|Installation de luminaires|Installation d'interrupteurs|Dépannage électrique|Installation de VMC|Câblage réseau RJ45|Installation de radiateurs électriques|Diagnostic électrique|Installation de borne de recharge|Éclairage extérieur",
 "Peinture & revêtements":"Peinture intérieure|Peinture extérieure|Peinture de plafond|Pose de papier peint|Enduit décoratif|Peinture de volets|Peinture de portail|Peinture de façade|Ravalement de façade|Pose de toile de verre|Laque sur boiserie|Peinture de sol garage|Effet béton ciré",
 "Sols & carrelage":"Pose de carrelage|Pose de faïence|Pose de parquet flottant|Pose de parquet massif|Ponçage et vitrification de parquet|Pose de moquette|Pose de lino|Pose de sol PVC|Chape et ragréage|Joints de carrelage|Rénovation de tomettes|Pose de terrasse en carrelage",
 "Maçonnerie & gros œuvre":"Ouverture de mur porteur|Construction de mur|Création de cloison|Dalle béton|Fondations|Extension de maison|Surélévation|Reprise en sous-œuvre|Pose de linteau|Escalier béton|Enduit de façade|Démolition|Terrassement",
 "Menuiserie & fermetures":"Pose de fenêtres PVC|Pose de fenêtres alu|Pose de fenêtres bois|Pose de porte d'entrée|Pose de porte intérieure|Pose de volets roulants|Motorisation de volets|Pose de portail|Pose de véranda|Pose de pergola|Placard sur mesure|Dressing sur mesure|Bibliothèque sur mesure|Escalier bois|Pose de parquet mural",
 "Plâtrerie & isolation":"Pose de placo|Faux plafond|Doublage de mur|Isolation des combles|Isolation par l'extérieur|Isolation des murs|Isolation phonique|Isolation de sous-sol|Bandes et enduits|Rebouchage de fissures|Cloison acoustique",
 "Toiture & charpente":"Réfection de toiture|Réparation de tuiles|Pose de zinc|Isolation de toiture|Traitement de charpente|Pose de velux|Pose de gouttières|Démoussage et hydrofuge|Étanchéité de toit terrasse|Bardage|Pose de faîtage|Charpente traditionnelle",
 "Cuisine & salle de bain":"Pose de cuisine équipée|Conception de cuisine sur mesure|Rénovation complète de salle de bain|Pose de plan de travail|Pose de crédence|Remplacement d'évier|Douche à l'italienne|Salle de bain PMR|Pose de meuble vasque|Rénovation de baignoire",
 "Chauffage & climatisation":"Installation de chaudière gaz|Entretien de chaudière|Installation de pompe à chaleur|Installation de climatisation|Entretien de climatisation|Pose de poêle à granulés|Pose de poêle à bois|Installation de plancher chauffant|Désembouage de radiateurs|Ramonage|Installation de thermostat connecté|Dépannage chauffage",
 "Aménagement extérieur":"Création de terrasse bois|Terrasse composite|Pose de clôture|Pose de grillage|Muret de jardin|Allée en pavés|Dalle pour abri de jardin|Montage d'abri de jardin|Pose de brise-vue|Escalier extérieur|Construction de pool house",
 })

C["Jardinage & Espaces verts"] = dict(icon="leaf", domain="jardin",
 variants=["ponctuel","contrat d'entretien annuel","avec évacuation des déchets","écologique","urgence après tempête"],
 fields=["surface_terrain","agrement_sap","evacuation_dechets","materiel_fourni","ecoresponsable"],
 subs={
 "Entretien courant":"Tonte de pelouse|Débroussaillage|Taille de haie|Désherbage|Ramassage de feuilles|Scarification|Aération de pelouse|Entretien de massifs|Binage|Arrosage de plantes|Entretien de jardin en abonnement|Entretien pendant absence",
 "Arbres & élagage":"Élagage d'arbre|Abattage d'arbre|Démontage d'arbre|Dessouchage|Taille douce|Taille fruitière|Haubanage|Diagnostic phytosanitaire|Broyage de branches|Élagage de palmier|Traitement du charançon rouge",
 "Création & aménagement":"Création de jardin|Plan de jardin paysager|Semis de gazon|Pose de gazon en rouleau|Gazon synthétique|Création de massif|Plantation d'arbres|Pose de bordures|Création de rocaille|Système d'arrosage automatique|Éclairage de jardin|Bassin de jardin|Création de potager|Mur végétal|Jardin japonais",
 "Potager & permaculture":"Installation de potager|Entretien de potager|Conseil en permaculture|Compostage|Serre de jardin|Culture hors-sol|Verger|Ruche et apiculture|Poulailler",
 "Piscine & bassin":"Entretien de piscine|Hivernage de piscine|Remise en route de piscine|Traitement de l'eau|Réparation de liner|Installation de pompe|Nettoyage de bassin|Installation de piscine hors-sol|Pose d'abri de piscine|Détection de fuite piscine",
 })

C["Dépannage & Urgences"] = dict(icon="siren", domain="depannage",
 variants=["urgence 24h/7j","week-end et jours fériés","nuit","déplacement rapide","devis gratuit"],
 fields=["urgence_24_7","delai_intervention","rayon_km","frais_deplacement","fourniture_incluse"],
 subs={
 "Serrurerie":"Ouverture de porte claquée|Ouverture de porte fermée à clé|Changement de serrure|Changement de cylindre|Blindage de porte|Pose de verrou|Réparation de rideau métallique|Ouverture de coffre-fort|Serrure connectée|Reproduction de clé|Sécurisation après effraction",
 "Vitrerie":"Remplacement de vitre cassée|Double vitrage|Vitrine de commerce|Miroir sur mesure|Survitrage|Vitrage de sécurité|Film anti-effraction|Remplacement de vitre de véranda|Dépannage vitrerie urgence",
 "Plomberie d'urgence":"Fuite d'eau urgente|Dégât des eaux|WC bouché|Évier bouché|Canalisation bouchée|Ballon d'eau chaude en panne|Fuite de radiateur|Recherche de fuite non destructive|Curage de canalisation|Pompage de cave inondée",
 "Électricité d'urgence":"Panne de courant|Court-circuit|Disjoncteur qui saute|Prise qui ne fonctionne plus|Odeur de brûlé électrique|Remise en service du tableau|Dépannage d'éclairage|Panne d'interphone",
 "Électroménager":"Réparation de lave-linge|Réparation de lave-vaisselle|Réparation de réfrigérateur|Réparation de four|Réparation de sèche-linge|Réparation de plaque induction|Réparation de micro-ondes|Installation d'électroménager|Diagnostic de panne électroménager",
 "Autres dépannages":"Déblocage de volet roulant|Réparation de porte de garage|Dépannage d'interphone|Dépannage de portail automatique|Réparation de store banne|Dépannage de VMC|Dépannage d'alarme|Bâchage d'urgence de toiture",
 })

C["Informatique & High-tech"] = dict(icon="laptop", domain="informatique",
 variants=["à domicile","en atelier","à distance","en entreprise","forfait assistance mensuelle"],
 fields=["type_appareil","technologies","delai_livraison","diplome"],
 subs={
 "Dépannage ordinateur":"Diagnostic de panne|Suppression de virus|Nettoyage et optimisation|Réinstallation de système|Récupération de données|Remplacement de disque dur|Ajout de mémoire RAM|Remplacement d'écran de portable|Réparation de carte mère|Changement de batterie|Nettoyage de ventilation|Montage de PC sur mesure|Transfert de données",
 "Smartphones & tablettes":"Remplacement d'écran de smartphone|Remplacement de batterie|Réparation de connecteur de charge|Désoxydation|Réparation de caméra|Déblocage opérateur|Transfert de données mobile|Réparation de tablette|Réparation de console de jeu|Pose de verre trempé",
 "Réseau & internet":"Installation de box internet|Configuration Wi-Fi|Répéteur et mesh|Câblage réseau|Installation de NAS|Configuration de VPN|Sécurisation de réseau|Installation de serveur|Configuration de pare-feu|Audit réseau|Fibre : raccordement intérieur",
 "Assistance & formation":"Initiation à l'informatique|Cours bureautique senior|Formation Excel|Formation Word|Formation Google Workspace|Aide aux démarches en ligne|Assistance à distance|Configuration de messagerie|Sauvegarde et cloud|Contrat d'assistance annuel|Sensibilisation cybersécurité",
 "Maison connectée":"Installation de domotique|Configuration d'assistant vocal|Installation de caméras connectées|Thermostat connecté|Éclairage connecté|Volets connectés|Installation de home cinéma|Installation de TV murale|Configuration de box TV|Sonorisation multiroom",
 "Infogérance & entreprise":"Infogérance de parc informatique|Maintenance de serveurs|Migration vers le cloud|Déploiement de postes|Administration Microsoft 365|Sauvegarde d'entreprise|Plan de reprise d'activité|Audit de sécurité|Support helpdesk|Téléphonie IP|Gestion des accès",
 })

C["Web, Digital & Marketing"] = dict(icon="globe", domain="digital",
 variants=["forfait projet","en régie","en abonnement","audit seul","avec formation incluse","en anglais"],
 fields=["technologies","type_livrable","delai_livraison","budget_projet","revisions_incluses","portfolio","confidentialite"],
 subs={
 "Création de sites web":"Site vitrine|Site e-commerce|Landing page|Site WordPress|Site Shopify|Site sur mesure|Refonte de site|Blog professionnel|Site multilingue|Portail intranet|Site immobilier|Site de réservation|Migration de site|Optimisation de vitesse|Mise en conformité RGPD",
 "Développement logiciel":"Application web|Application mobile iOS|Application mobile Android|Application React Native|API REST|Intégration de paiement|Automatisation de tâches|Développement de plugin|Scraping de données|Bot Discord/Telegram|Logiciel métier sur mesure|Reprise de code existant|Revue de code|Tests automatisés|Déploiement CI/CD",
 "SEO & acquisition":"Audit SEO|Optimisation SEO on-page|Netlinking|Rédaction SEO|SEO local|SEO technique|Suivi de positionnement|Campagne Google Ads|Campagne Meta Ads|Campagne TikTok Ads|Campagne LinkedIn Ads|Retargeting|Optimisation de taux de conversion|Google Business Profile",
 "Réseaux sociaux":"Community management|Création de calendrier éditorial|Création de visuels réseaux sociaux|Montage de Reels|Gestion Instagram|Gestion TikTok|Gestion LinkedIn|Gestion Facebook|Gestion X (Twitter)|Modération de communauté|Stratégie d'influence|Partenariat influenceur|Formation réseaux sociaux",
 "Design & identité visuelle":"Création de logo|Charte graphique|Identité de marque complète|Design UX/UI|Maquette Figma|Design d'application|Illustration sur mesure|Motion design|Habillage vidéo|Design de packaging|Carte de visite|Flyer et affiche|Plaquette commerciale|Brochure|Signalétique|Design de newsletter",
 "Rédaction & contenu":"Rédaction d'articles de blog|Rédaction de fiches produits|Rédaction de page web|Copywriting publicitaire|Storytelling de marque|Rédaction de livre blanc|Rédaction de communiqué de presse|Correction et relecture|Traduction de site|Transcription audio|Sous-titrage|Ghostwriting|Newsletter",
 "Data, IA & automatisation":"Tableau de bord Power BI|Tableau de bord Looker Studio|Analyse de données|Nettoyage de base de données|Automatisation Make/Zapier|Chatbot IA|Intégration d'API IA|Agent IA sur mesure|Formation à l'IA générative|Web analytics|Tracking GA4|Modèle de scoring|Reporting automatisé",
 "E-commerce & marketplace":"Ouverture de boutique en ligne|Optimisation de fiches produits|Gestion de catalogue|Intégration de flux produits|Vente sur Amazon|Vente sur Etsy|Gestion des avis clients|Stratégie de prix|Optimisation du tunnel d'achat|Emailing automation|Programme de fidélité",
 })

C["Photo, Vidéo & Audio"] = dict(icon="camera", domain="audiovisuel",
 variants=["en studio","en extérieur","avec retouches","livraison express","avec drone","pack complet"],
 fields=["type_evenement","date_evenement","duree_prestation_h","type_livrable","delai_livraison","portfolio","nb_intervenants"],
 subs={
 "Photographie événementielle":"Photographe de mariage|Photographe de fiançailles|Photographe de baptême|Photographe d'anniversaire|Photographe de soirée|Photographe de séminaire|Photographe de concert|Photographe de remise de diplôme|Photographe de salon professionnel|Photobooth",
 "Photographie de portrait":"Shooting portrait|Portrait corporate|Photo de CV|Shooting book mannequin|Shooting famille|Shooting grossesse|Shooting nouveau-né|Shooting enfant|Shooting couple|Shooting boudoir|Shooting de groupe",
 "Photographie professionnelle":"Photo de produits|Packshot e-commerce|Photo culinaire|Photo immobilière|Visite virtuelle 360|Photo d'architecture|Photo de chantier|Reportage d'entreprise|Photo de mode|Photo publicitaire|Photo de véhicule",
 "Vidéo":"Film de mariage|Clip vidéo|Vidéo d'entreprise|Interview filmée|Aftermovie|Captation d'événement|Vidéo produit|Publicité vidéo|Vidéo immobilière|Vidéo de formation|Live streaming|Vidéo TikTok/Reels|Documentaire court",
 "Drone & prises de vue aériennes":"Prise de vue aérienne photo|Vidéo aérienne|Inspection de toiture par drone|Suivi de chantier par drone|Cartographie par drone|Vidéo immobilière par drone|Drone pour événement",
 "Post-production":"Montage vidéo|Étalonnage|Retouche photo|Détourage|Colorimétrie|Sous-titrage vidéo|Motion design d'insert|Mixage audio|Création de teaser|Album photo|Tirage et impression|Numérisation de photos anciennes|Numérisation de cassettes",
 "Audio & musique":"Enregistrement studio|Mixage de titre|Mastering|Composition sur mesure|Production de beat|Voix off|Podcast : enregistrement|Podcast : montage|Sonorisation d'événement|Location de matériel son|Ingénieur du son|Doublage",
 })

C["Événementiel & Réception"] = dict(icon="party-popper", domain="evenementiel",
 variants=["clé en main","avec matériel","sans matériel","pour entreprise","pour particulier","week-end"],
 fields=["type_evenement","nb_invites","date_evenement","duree_prestation_h","nb_intervenants","materiel_fourni"],
 subs={
 "Organisation d'événements":"Wedding planner|Organisation d'anniversaire|Organisation de séminaire|Organisation de team building|Organisation de soirée d'entreprise|Organisation de lancement de produit|Organisation de salon|Organisation de baby shower|Organisation d'EVJF/EVG|Coordination du jour J|Recherche de lieu|Gestion des prestataires",
 "Décoration événementielle":"Décoration de salle|Décoration florale|Arche de mariage|Mur de ballons|Centre de table|Décoration de table|Scénographie|Location de mobilier déco|Décoration lumineuse|Signalétique événementielle|Décoration de voiture|Décoration de Noël",
 "Animation & spectacle":"DJ|Groupe de musique live|Chanteur|Musicien solo|Magicien|Close-up|Caricaturiste|Comédien|Troupe de danse|Spectacle de feu|Mascotte|Animateur de soirée|Karaoké|Blind test|Escape game mobile|Casino événementiel|Photocall animé",
 "Traiteur & réception":"Traiteur mariage|Traiteur d'entreprise|Cocktail dînatoire|Buffet froid|Plateaux repas|Food truck|Bar à cocktails|Barman|Service de serveurs|Location de vaisselle|Pièce montée|Bar à desserts|Brunch|Méchoui|Cuisine du monde événementielle",
 "Logistique & matériel":"Location de chapiteau|Location de tente|Location de sonorisation|Location de scène|Location d'éclairage|Location de mobilier|Location de vidéoprojecteur|Location de groupe électrogène|Location de sanitaires mobiles|Montage et démontage|Régie technique|Sécurité événementielle|Voiturier|Vestiaire",
 })

C["Restauration & Alimentation"] = dict(icon="chef-hat", domain="restauration",
 variants=["à domicile","en entreprise","sur commande","en atelier","livraison incluse","pour événement"],
 fields=["type_cuisine","allergenes","nb_invites","service_inclus","materiel_fourni","diplome"],
 subs={
 "Chef à domicile":"Chef à domicile dîner|Repas gastronomique|Menu dégustation|Chef pour événement familial|Chef en villa de vacances|Chef pour entreprise|Préparation de repas de la semaine|Batch cooking|Menu végétarien|Menu vegan|Menu sans gluten|Chef pour régime spécifique",
 "Pâtisserie & boulangerie":"Gâteau d'anniversaire personnalisé|Wedding cake|Number cake|Cupcakes|Macarons|Pièce montée|Cake design|Gâteau sans gluten|Viennoiseries sur commande|Pain artisanal|Chocolats artisanaux|Calissons et confiseries|Buffet sucré",
 "Cours de cuisine":"Cours de cuisine à domicile|Atelier pâtisserie|Atelier sushi|Atelier pâtes fraîches|Atelier chocolat|Atelier cuisine du monde|Atelier cuisine enfant|Team building culinaire|Cours de cuisine végétarienne|Atelier boulangerie|Cours d'œnologie|Atelier cocktails",
 "Service traiteur spécialisé":"Plateaux repas entreprise|Petit-déjeuner d'entreprise|Pause gourmande séminaire|Livraison de repas quotidiens|Traiteur halal|Traiteur casher|Traiteur africain|Traiteur asiatique|Traiteur libanais|Traiteur italien|Traiteur antillais|Traiteur indien",
 "Production alimentaire artisanale":"Conserves artisanales|Confitures maison|Miel de producteur|Fromage fermier|Charcuterie artisanale|Produits de la ferme|Panier de légumes|Vente directe producteur|Bières artisanales|Jus de fruits pressés|Épicerie fine sur mesure",
 })

C["Transport & Logistique"] = dict(icon="truck", domain="transport",
 variants=["avec chauffeur","longue distance","courte distance","en urgence","le week-end","avec assurance"],
 fields=["type_vehicule","capacite_passagers","volume_m3","distance_km","licence_transport","nb_intervenants"],
 subs={
 "VTC & chauffeur privé":"Course VTC|Transfert aéroport|Transfert gare|Mise à disposition avec chauffeur|VTC longue distance|Chauffeur pour mariage|Chauffeur d'affaires|Navette d'entreprise|VTC véhicule van|VTC berline haut de gamme|Course de nuit|Chauffeur bilingue",
 "Taxi & transport de personnes":"Taxi conventionné|Transport médical assis|Transport PMR|Navette scolaire|Transport de groupe en minibus|Autocar avec chauffeur|Transport de sportifs|Transport de personnes âgées|Accompagnement en transport",
 "Déménagement":"Déménagement complet|Déménagement économique|Déménagement d'entreprise|Déménagement international|Location de camion avec chauffeur|Portage de meubles|Monte-meubles|Emballage et cartons|Démontage et remontage de meubles|Garde-meuble|Transfert de piano|Déménagement d'un seul meuble|Manutention",
 "Livraison & coursier":"Livraison express en ville|Coursier à vélo|Coursier à scooter|Livraison de repas|Livraison de colis|Livraison de meubles|Livraison de courses|Transport de plis urgents|Livraison le dimanche|Livraison réfrigérée|Livraison de fleurs",
 "Transport de marchandises":"Transport palettes|Transport de matériaux|Transport de véhicules|Transport d'engins|Transport de bateau|Transport frigorifique|Transport de déchets|Affrètement|Transport de matériel événementiel|Transport d'œuvres d'art",
 "Transport spécifique":"Transport d'animaux|Taxi animalier|Transport de vélos|Convoyage de véhicule|Transport de matériel médical|Transport scolaire adapté|Transport de dossiers confidentiels",
 })

C["Automobile & Mobilité"] = dict(icon="car", domain="automobile",
 variants=["à domicile","en atelier","avec pièces fournies","diagnostic inclus","toutes marques"],
 fields=["type_vehicule","marque_modele","kilometrage","fourniture_incluse","garantie_decennale"],
 subs={
 "Mécanique":"Vidange|Révision complète|Remplacement de plaquettes de frein|Remplacement de disques|Changement de courroie de distribution|Remplacement d'embrayage|Diagnostic électronique|Réparation de démarreur|Changement d'alternateur|Remplacement de batterie|Changement d'amortisseurs|Distribution + pompe à eau|Réparation de boîte de vitesses|Reprogrammation moteur",
 "Carrosserie & esthétique":"Réparation de pare-chocs|Débosselage sans peinture|Peinture d'élément|Remplacement de pare-brise|Polissage|Rénovation d'optiques de phares|Covering total|Covering partiel|Pose de film teinté|Antigravillon|Rénovation de jantes|Réparation de rayures",
 "Entretien & lavage":"Lavage auto à domicile|Lavage sans eau|Nettoyage intérieur complet|Shampoing de sièges|Traitement céramique|Lustrage|Nettoyage de moteur|Désinfection d'habitacle|Traitement anti-odeur|Lavage de flotte d'entreprise",
 "Pneumatiques":"Montage de pneus|Équilibrage|Géométrie et parallélisme|Réparation de crevaison|Permutation de pneus|Stockage de pneus|Pneus hiver|Dépannage crevaison à domicile",
 "Deux-roues & vélo":"Révision de moto|Réparation de scooter|Changement de pneus moto|Entretien de vélo|Réparation de vélo électrique|Changement de batterie de trottinette|Réparation de trottinette|Montage de vélo|Réglage de dérailleur|Réparation de chambre à air",
 "Services automobiles":"Convoyage de véhicule|Préparation au contrôle technique|Recherche de véhicule|Expertise avant achat|Dépannage et remorquage|Démarrage de batterie|Livraison de carburant|Sortie de véhicule embourbé|Ouverture de véhicule|Reproduction de clé de voiture",
 })

C["Animaux"] = dict(icon="paw-print", domain="animaux",
 variants=["à domicile","en pension","en visite quotidienne","en urgence","pour les vacances"],
 fields=["espece_animal","taille_animal","nb_animaux","capacite_animaux","diplome","agrement_sap"],
 subs={
 "Garde d'animaux":"Garde à domicile du propriétaire|Pension canine|Pension féline|Garde de NAC|Visite quotidienne|Garde de nuit|Garde longue durée|Garde d'urgence|Famille d'accueil|Garde de chevaux",
 "Promenade & activité":"Promenade de chien|Promenade collective|Sortie en forêt|Course avec chien (canicross)|Sortie chiot|Sortie chien âgé|Baignade encadrée|Jeux et stimulation",
 "Toilettage":"Toilettage chien petit gabarit|Toilettage chien grand gabarit|Toilettage chat|Bain et brossage|Tonte|Épilation|Coupe de griffes|Nettoyage des oreilles|Soin de pelage|Toilettage à domicile|Détartrage sans anesthésie|Toilettage de chien nordique",
 "Éducation & comportement":"Éducation canine de base|Éducation chiot|Rééducation comportementale|Marche en laisse|Rappel|Gestion de l'agressivité|Anxiété de séparation|Propreté|Éducation féline|Cours collectif d'éducation|Préparation au test de sociabilité|Dressage sportif",
 "Santé animale":"Vétérinaire à domicile|Ostéopathie animale|Physiothérapie animale|Massage canin|Naturopathie animale|Soins palliatifs animaux|Vaccination|Identification par puce|Conseil nutrition animale|Taxi vétérinaire",
 "Équidés & ferme":"Pension de chevaux|Débourrage|Cours d'équitation|Maréchalerie|Dentisterie équine|Tonte de moutons|Soins aux animaux de ferme|Gardiennage d'écurie",
 })

C["Cours & Formation"] = dict(icon="graduation-cap", domain="formation",
 variants=["à domicile","en visio","en petit groupe","stage intensif","préparation examen","éligible CPF"],
 fields=["niveau_scolaire","format_cours","langue_enseignee","certif_preparee","eligible_cpf","age_public","diplome"],
 subs={
 "Soutien scolaire":"Cours de mathématiques|Cours de français|Cours de physique-chimie|Cours de SVT|Cours d'histoire-géographie|Cours de philosophie|Cours d'économie|Cours de SES|Cours de latin|Cours de grec|Préparation au brevet|Préparation au bac|Préparation au bac de français|Stage de révision|Méthodologie|Aide aux devoirs|Cours de comptabilité|Préparation Parcoursup",
 "Langues":"Cours d'anglais|Cours d'espagnol|Cours d'allemand|Cours d'italien|Cours de portugais|Cours d'arabe|Cours de chinois|Cours de japonais|Cours de russe|Cours de FLE|Conversation en anglais|Anglais professionnel|Préparation TOEIC|Préparation IELTS|Préparation TOEFL|Préparation DELF|Cours de langue des signes|Séjour linguistique encadré",
 "Musique":"Cours de piano|Cours de guitare|Cours de guitare électrique|Cours de basse|Cours de batterie|Cours de violon|Cours de violoncelle|Cours de flûte|Cours de saxophone|Cours de trompette|Cours de chant|Technique vocale|Cours de MAO|Solfège|Cours de DJ|Cours d'accordéon|Cours de harpe|Cours de ukulélé|Éveil musical enfant",
 "Arts & création":"Cours de dessin|Cours de peinture|Aquarelle|Cours de sculpture|Poterie et céramique|Cours de photographie|Cours de calligraphie|Cours de BD/manga|Cours de couture|Cours de tricot|Cours de broderie|Cours de bijouterie|Atelier de scrapbooking|Cours de théâtre|Cours d'improvisation|Cours d'écriture créative",
 "Informatique & numérique":"Initiation informatique|Cours de bureautique|Formation Excel avancé|Formation VBA|Cours de programmation Python|Cours de développement web|Cours de HTML/CSS|Cours de JavaScript|Formation WordPress|Formation Photoshop|Formation Illustrator|Formation InDesign|Formation Canva|Formation montage vidéo|Formation IA générative|Cybersécurité pour tous",
 "Formation professionnelle":"Formation en management|Formation en vente|Formation prise de parole en public|Formation gestion du temps|Formation RH|Formation comptabilité|Formation en marketing digital|Formation sécurité au travail|Formation SST|Formation HACCP|Habilitation électrique|CACES|Formation incendie|Formation gestes et postures|Bilan de compétences|VAE : accompagnement",
 "Conduite & permis":"Cours de code de la route|Leçon de conduite|Conduite accompagnée|Perfectionnement conduite|Stage de récupération de points|Préparation permis moto|Permis bateau|Conduite éco-responsable|Reprise de confiance au volant",
 })

C["Services administratifs & Juridiques"] = dict(icon="scale", domain="juridique",
 variants=["en visio","au cabinet","forfait","urgent","avec dépôt des dossiers"],
 fields=["type_contrat","confidentialite","diplome","delai_livraison","langues_parlees"],
 subs={
 "Aide administrative":"Rédaction de courrier administratif|Aide aux démarches CAF|Aide aux démarches CPAM|Déclaration d'impôts|Dossier de retraite|Dossier de naturalisation|Titre de séjour : constitution du dossier|Demande de logement social|Aide au dossier MDPH|Constitution de dossier de surendettement|Numérisation et archivage|Secrétariat administratif|Aide à la déclaration URSSAF",
 "Comptabilité & gestion":"Tenue de comptabilité|Bilan annuel|Déclaration de TVA|Établissement de fiches de paie|Déclarations sociales|Facturation|Recouvrement de créances|Tableau de bord financier|Prévisionnel financier|Business plan|Audit comptable|Comptabilité d'association|Gestion de note de frais",
 "Conseil juridique":"Consultation juridique|Rédaction de contrat|Rédaction de CGV|Rédaction de statuts|Bail commercial|Bail d'habitation|Droit du travail : conseil|Rupture conventionnelle|Litige de voisinage|Litige de consommation|Droit de la famille|Divorce : accompagnement|Succession|Droit des étrangers|Dépôt de marque|Protection de la propriété intellectuelle|Mise en conformité RGPD",
 "Création & vie de l'entreprise":"Création de société|Immatriculation micro-entreprise|Modification de statuts|Transfert de siège social|Dissolution et liquidation|Domiciliation d'entreprise|Rédaction de pacte d'associés|Cession de fonds de commerce|Reprise d'entreprise|Dépôt des comptes annuels",
 "Assurance & courtage":"Courtage en assurance auto|Courtage en assurance habitation|Assurance santé|Assurance emprunteur|Assurance professionnelle|Courtage en crédit immobilier|Rachat de crédit|Conseil en placement|Optimisation d'épargne|Préparation de la retraite|Déclaration de sinistre|Expertise d'assuré",
 "Traduction & interprétariat":"Traduction français-anglais|Traduction français-espagnol|Traduction assermentée|Traduction juridique|Traduction technique|Traduction médicale|Interprétariat en réunion|Interprétariat téléphonique|Interprétariat LSF|Relecture de traduction|Localisation de site web",
 "Ressources humaines":"Recrutement de collaborateur|Sourcing de candidats|Rédaction de fiche de poste|Conduite d'entretiens|Test de personnalité|Onboarding|Rédaction de contrat de travail|Gestion des congés|Audit social|Plan de formation|Entretien professionnel|Outplacement",
 })

C["Conseil & Business"] = dict(icon="briefcase", domain="conseil",
 variants=["en visio","sur site","mission courte","mission longue","atelier collectif","audit + plan d'action"],
 fields=["confidentialite","budget_projet","type_livrable","clientele","experience"],
 subs={
 "Stratégie & organisation":"Conseil en stratégie|Étude de marché|Business model|Plan de développement|Diagnostic d'entreprise|Optimisation des processus|Conduite du changement|Transformation digitale|Structuration d'équipe|Gestion de projet|Direction de projet externalisée|Lean management",
 "Coaching professionnel":"Coaching de dirigeant|Coaching d'équipe|Coaching de carrière|Reconversion professionnelle|Préparation à un entretien|Coaching prise de poste|Gestion du stress au travail|Prévention du burn-out|Codéveloppement|Mentorat entrepreneurial|Coaching de commerciaux",
 "Vente & développement commercial":"Prospection commerciale|Téléprospection|Prise de rendez-vous qualifiés|Développement de portefeuille clients|Formation à la vente|Script de vente|Négociation commerciale|Mise en place d'un CRM|Analyse du tunnel de vente|Commercial externalisé",
 "Finance & levée de fonds":"Recherche de financement|Préparation de levée de fonds|Pitch deck|Modélisation financière|Valorisation d'entreprise|Dossier bancaire|Recherche de subventions|Crédit d'impôt recherche|Gestion de trésorerie|Contrôle de gestion externalisé",
 "Qualité, RSE & conformité":"Certification ISO 9001|Certification ISO 14001|Démarche RSE|Bilan carbone|Audit énergétique d'entreprise|Document unique (DUERP)|Conformité RGPD|Qualiopi : accompagnement|HACCP : mise en place|Sécurité au travail",
 })

C["Immobilier & Habitat"] = dict(icon="home", domain="immobilier",
 variants=["pour vente","pour location","urgent","avec rapport photo","pour investisseur"],
 fields=["type_bien","surface_m2","surface_terrain","type_logement","delai_livraison","portfolio"],
 subs={
 "Diagnostics immobiliers":"DPE|Diagnostic amiante|Diagnostic plomb|Diagnostic électricité|Diagnostic gaz|État parasitaire (termites)|Mesurage loi Carrez|Diagnostic assainissement|État des risques (ERP)|Pack de diagnostics vente|Pack de diagnostics location|Audit énergétique réglementaire",
 "Transaction & gestion":"Estimation immobilière|Mandat de vente|Recherche de bien|Chasseur d'appartement|Visite pour un acheteur à distance|Gestion locative|Recherche de locataire|Rédaction de bail|État des lieux d'entrée|État des lieux de sortie|Gestion de copropriété|Syndic bénévole : assistance|Conciergerie Airbnb|Gestion de location saisonnière",
 "Aménagement & décoration":"Architecte d'intérieur|Décorateur d'intérieur|Home staging|Plan 3D|Conseil en agencement|Shopping list déco|Coaching déco en visio|Aménagement de petit espace|Aménagement de bureau|Choix des couleurs|Feng shui|Aménagement de commerce",
 "Construction & maîtrise d'œuvre":"Maîtrise d'œuvre|Suivi de chantier|Dépôt de permis de construire|Déclaration préalable de travaux|Étude de faisabilité|Plans d'architecte|Étude thermique RE2020|Assistance à maîtrise d'ouvrage|Réception de travaux|Expertise de fissures|Expertise avant achat",
 "Services à l'habitat":"Conciergerie privée|Gardiennage de résidence|Surveillance de logement vacant|Réception de colis|Ouverture pour prestataire|Petits travaux à domicile|Homme toutes mains|Montage de meubles|Accrochage de tableaux|Pose d'étagères|Fixation de TV murale|Changement d'ampoules en hauteur",
 })

C["Énergie & Écologie"] = dict(icon="zap", domain="energie",
 variants=["avec aides financières","clé en main","audit préalable","garantie 10 ans","pour entreprise"],
 fields=["surface_m2","type_logement","garantie_decennale","fourniture_incluse","ecoresponsable"],
 subs={
 "Solaire & renouvelable":"Installation de panneaux solaires|Panneaux photovoltaïques en autoconsommation|Kit solaire plug and play|Solaire thermique|Maintenance de panneaux solaires|Batterie de stockage|Éolienne domestique|Raccordement Enedis|Étude de rentabilité solaire",
 "Chauffage performant":"Pompe à chaleur air/eau|Pompe à chaleur air/air|Chauffe-eau thermodynamique|Chaudière biomasse|Poêle à granulés|Géothermie|Régulation de chauffage|Entretien de PAC",
 "Isolation & rénovation énergétique":"Isolation des combles perdus|Isolation des rampants|Isolation par l'extérieur (ITE)|Isolation des planchers bas|Calorifugeage|Étanchéité à l'air|Test d'infiltrométrie|Rénovation globale|Dossier MaPrimeRénov'|Accompagnement Mon Accompagnateur Rénov'",
 "Mobilité & bornes":"Installation de borne de recharge|Borne de recharge en copropriété|Borne pour entreprise|Maintenance de borne|Installation de prise renforcée|Étude d'infrastructure de recharge",
 "Eau & déchets":"Récupérateur d'eau de pluie|Installation d'assainissement individuel|Vidange de fosse septique|Contrôle d'assainissement|Compostage collectif|Tri et valorisation des déchets|Collecte de biodéchets|Économiseurs d'eau",
 })

C["Sécurité & Surveillance"] = dict(icon="shield", domain="securite",
 variants=["24h/7j","ponctuel","contrat annuel","pour événement","avec télésurveillance"],
 fields=["nb_intervenants","urgence_24_7","diplome","clientele","duree_prestation_h"],
 subs={
 "Gardiennage & agents":"Agent de sécurité|Agent de sécurité incendie (SSIAP)|Maître-chien|Vigile de magasin|Sécurité de chantier|Sécurité d'événement|Contrôle d'accès|Rondier de nuit|Garde du corps|Agent d'accueil et de sécurité",
 "Systèmes de sécurité":"Installation d'alarme|Installation de vidéosurveillance|Télésurveillance|Contrôle d'accès par badge|Interphone et visiophone|Détecteur de fumée|Détecteur de monoxyde|Coffre-fort : installation|Maintenance de système d'alarme|Sécurisation de local commercial",
 "Sécurité incendie":"Vérification d'extincteurs|Installation d'extincteurs|Plan d'évacuation|Exercice d'évacuation|Désenfumage|Formation à la manipulation d'extincteurs|Registre de sécurité|Éclairage de secours",
 "Cybersécurité":"Audit de cybersécurité|Test d'intrusion|Sécurisation de messagerie|Protection contre le phishing|Sauvegarde sécurisée|Réponse à incident|Sensibilisation des salariés|Mise en conformité NIS2",
 })

C["Artisanat & Création sur mesure"] = dict(icon="scissors", domain="artisanat",
 variants=["sur mesure","en série limitée","personnalisé","avec matière fournie","réparation seule"],
 fields=["delai_livraison","portfolio","fourniture_incluse","revisions_incluses","ecoresponsable"],
 subs={
 "Couture & retouches":"Ourlet de pantalon|Retouche de robe|Retouche de costume|Changement de fermeture éclair|Reprise de taille|Robe de mariée : retouche|Création de vêtement sur mesure|Doublure|Rideaux sur mesure|Housse de coussin|Broderie personnalisée|Flocage textile|Customisation de vêtement|Upcycling textile",
 "Bois & mobilier":"Meuble sur mesure|Table sur mesure|Restauration de meuble ancien|Rénovation de chaise|Cannage et paillage|Marqueterie|Tournage sur bois|Sculpture sur bois|Fabrication d'étagères|Tête de lit sur mesure|Verrière atelier|Escalier sur mesure",
 "Métal & soudure":"Ferronnerie d'art|Portail en fer forgé|Garde-corps|Soudure sur place|Structure métallique|Rampe d'escalier|Mobilier métal|Réparation de portail|Serrurerie métallerie|Découpe laser métal",
 "Bijoux & accessoires":"Création de bijou sur mesure|Alliance sur mesure|Réparation de bijou|Mise à taille de bague|Gravure|Perlage|Maroquinerie sur mesure|Réparation de sac|Cordonnerie|Ressemelage|Réparation de chaussures|Fabrication de ceinture",
 "Arts & décoration":"Tableau sur commande|Portrait dessiné|Fresque murale|Graffiti décoratif|Trompe-l'œil|Poterie sur commande|Céramique personnalisée|Vitrail|Mosaïque|Encadrement|Restauration de tableau|Sculpture sur commande",
 "Fabrication numérique":"Impression 3D|Modélisation 3D|Découpe laser|Gravure laser|Prototypage rapide|Scan 3D|Fabrication de pièce de rechange|Objet publicitaire personnalisé|Impression textile|Impression grand format|Stickers personnalisés|Signalétique sur mesure",
 })

C["Mode, Image & Développement personnel"] = dict(icon="shirt", domain="image",
 variants=["en visio","en boutique","à domicile","forfait complet","pour entreprise"],
 fields=["genre_clientele","duree_prestation_h","portfolio","format_cours"],
 subs={
 "Conseil en image":"Relooking complet|Conseil en colorimétrie|Analyse morphologique|Personal shopper|Tri de garde-robe|Conseil vestimentaire homme|Conseil vestimentaire femme|Relooking capillaire|Conseil image professionnelle|Préparation shooting|Conseil pour entretien d'embauche",
 "Développement personnel":"Coaching de vie|Confiance en soi|Gestion des émotions|Définition d'objectifs|Équilibre vie pro/perso|Coaching relationnel|Coaching de couple|Prise de parole|Coaching de sortie de crise|Atelier estime de soi|Coaching de motivation",
 "Bien-être au travail":"Atelier gestion du stress en entreprise|Massage assis en entreprise|Sophrologie en entreprise|Yoga au bureau|Prévention des RPS|Conférence bien-être|Aménagement ergonomique du poste|Atelier cohésion d'équipe",
 })

C["Musique & Spectacle vivant"] = dict(icon="music", domain="spectacle",
 variants=["en solo","en groupe","avec sonorisation","répertoire sur mesure","pour cérémonie"],
 fields=["type_evenement","nb_invites","duree_prestation_h","materiel_fourni","portfolio"],
 subs={
 "Musiciens & groupes":"Groupe de variété|Groupe de jazz|Groupe de rock|Duo acoustique|Quatuor à cordes|Pianiste de cocktail|Harpiste|Saxophoniste|Violoniste|Chanteuse de cérémonie|Gospel|Musique traditionnelle|Orchestre de bal|DJ live",
 "Arts de la scène":"Comédien pour événement|Troupe de théâtre|Improvisation théâtrale|Spectacle de danse|Cirque et acrobatie|Jongleur|Échassier|Mime|Marionnettes|Conteur|Spectacle de rue|Cabaret",
 "Technique du spectacle":"Régisseur son|Régisseur lumière|Technicien plateau|Location de backline|Montage de scène|Direction technique|Éclairagiste|Vidéo mapping",
 })

C["Services aux entreprises"] = dict(icon="building", domain="entreprise",
 variants=["à distance","sur site","au forfait","à l'heure","en abonnement mensuel"],
 fields=["clientele","confidentialite","delai_livraison","type_livrable","langues_parlees"],
 subs={
 "Secrétariat & assistanat":"Secrétariat externalisé|Assistant virtuel|Permanence téléphonique|Gestion d'agenda|Saisie de données|Rédaction de compte-rendu|Gestion de la boîte mail|Organisation de déplacements|Facturation et relance|Office manager externalisé|Assistant de direction ponctuel",
 "Logistique & manutention":"Manutention ponctuelle|Préparation de commandes|Inventaire|Réassort de rayons|Montage de stand|Mise en rayon|Gestion de stock|Étiquetage|Emballage et conditionnement|Palettisation",
 "Accueil & réception":"Hôtesse d'accueil|Hôte d'accueil événementiel|Standardiste|Accueil de salon|Distribution de flyers|Street marketing|Animation commerciale|Démonstration produit|Dégustation en magasin",
 "Externalisation métier":"Community manager externalisé|Direction artistique externalisée|DAF externalisé|DRH externalisé|DSI externalisé|Responsable marketing externalisé|Chef de projet freelance|Consultant en mission",
 "Impression & fournitures":"Impression de documents|Impression de cartes de visite|Impression d'affiches|Reliure|Plastification|Marquage textile|Objets publicitaires|Tampons personnalisés|Kakémonos et roll-up|Adhésif vitrine|Covering de véhicule",
 })

C["Services funéraires & Assistance de vie"] = dict(icon="dove", domain="funeraire",
 variants=["24h/7j","forfait complet","accompagnement administratif","à domicile"],
 fields=["delai_intervention","urgence_24_7","clientele","diplome"],
 subs={
 "Organisation d'obsèques":"Organisation d'obsèques complète|Démarches administratives de décès|Transport de corps|Cérémonie civile|Maître de cérémonie|Crémation : organisation|Inhumation : organisation|Rapatriement de corps|Contrat obsèques : conseil",
 "Prestations associées":"Fleurs de deuil|Gravure de plaque|Entretien de sépulture|Rénovation de monument|Faire-part de décès|Livre de condoléances|Vidéo hommage|Accompagnement au deuil|Vide et débarras après décès|Succession : accompagnement",
 })

# --------------------------------------------------------- règles de champs
KEYWORD_FIELDS = [
 (r"urgen|dépann|fuite|bouch|panne|serrur|vitre", ["urgence_24_7","delai_intervention","frais_deplacement"]),
 (r"m²|surface|peinture|carrelage|isolation|ménage|nettoyage|toiture|façade", ["surface_m2"]),
 (r"mariage|anniversaire|événement|séminaire|soirée|réception", ["type_evenement","nb_invites","date_evenement"]),
 (r"cours|formation|atelier|initiation|préparation|stage", ["format_cours","age_public","eligible_cpf"]),
 (r"chien|chat|animal|animaux|toilettage|vétérinaire", ["espece_animal","taille_animal","nb_animaux"]),
 (r"véhicule|voiture|auto|moto|pneu|carrosserie|vidange", ["type_vehicule","marque_modele","kilometrage"]),
 (r"site|web|app|seo|développ|design|logo|api|données", ["technologies","delai_livraison","revisions_incluses"]),
 (r"traduction|rédaction|relecture|transcription", ["langues_parlees","delai_livraison"]),
 (r"enfant|bébé|nourrisson|scolaire|devoirs|baby", ["age_public","agrement_sap"]),
 (r"senior|dépendance|handicap|domicile.*aide|auxiliaire", ["agrement_sap","gestes_medicaux"]),
 (r"photo|vidéo|montage|drone|shooting|film", ["type_livrable","delai_livraison","portfolio"]),
 (r"livraison|transport|déménag|coursier|vtc|taxi", ["distance_km","volume_m3","type_vehicule"]),
 (r"repas|cuisine|traiteur|gâteau|pâtiss|chef", ["type_cuisine","allergenes","nb_invites"]),
 (r"massage|soin|relaxation|yoga|sophro", ["duree_prestation_h","objectif"]),
 (r"contrat|juridique|bail|statut|litige|assurance", ["type_contrat","confidentialite"]),
 (r"diagnostic|dpe|immobili|bail|location|estimation", ["type_bien","surface_m2"]),
 (r"cheveux|coiffure|coupe|coloration|brushing|tresse|barbe", ["longueur_cheveux","type_cheveux","genre_clientele"]),
 (r"peau|visage|épilation|soin du corps|maquillage", ["type_peau","genre_clientele"]),
 (r"coach|sportif|fitness|musculation|entraînement|danse", ["discipline","objectif","materiel_sport"]),
]

def fields_for(cat_fields, path_text):
    out = list(BASE_FIELDS)
    for f in cat_fields:
        if f in FIELD_INDEX and f not in out:
            out.append(f)
    low = path_text.lower()
    for pattern, flds in KEYWORD_FIELDS:
        if re.search(pattern, low):
            for f in flds:
                if f in FIELD_INDEX and f not in out:
                    out.append(f)
    return out

# --------------------------------------------- professions réglementées
REGULATED = [
 (r"infirm|prise de sang|injection|perfusion|pansement|toilette médicalis|vaccination|sonde|stomie", ["Diplôme d'État d'infirmier","Inscription ADELI/RPPS"]),
 (r"kiné|rééducation|drainage lymphatique médical", ["Diplôme d'État de masseur-kinésithérapeute"]),
 (r"ostéopath|chiroprac|étiopath", ["Diplôme d'ostéopathie agréé"]),
 (r"podolog|pédicurie médicale|semelles orthopédiques", ["Diplôme d'État de pédicure-podologue"]),
 (r"psycholog|psychothérap|bilan psychologique", ["Titre de psychologue protégé (ADELI)"]),
 (r"orthophon|orthopt", ["Certificat de capacité"]),
 (r"sage-femme|monitoring|rééducation périnéale sage", ["Diplôme d'État de sage-femme"]),
 (r"vétérinaire", ["Inscription à l'Ordre des vétérinaires"]),
 (r"diététi", ["BTS diététique / DUT génie biologique"]),
 (r"vtc|taxi|transport de personnes|autocar|minibus|navette", ["Carte VTC ou ADS taxi","Attestation de capacité de transport"]),
 (r"déménag|transport palettes|affrètement|transport de marchandises", ["Licence de transport intérieur / communautaire"]),
 (r"électri|tableau électrique|borne de recharge|habilitation", ["Habilitation électrique","Qualification Qualifelec / IRVE"]),
 (r"gaz|chaudière|pompe à chaleur|climatisation|fluide frigorigène", ["Attestation d'aptitude fluides frigorigènes","PG / Professionnel Gaz"]),
 (r"agent de sécurité|vigile|maître-chien|garde du corps|ssiap|télésurveillance|rondier", ["Carte professionnelle CNAPS"]),
 (r"amiante|plomb|dpe|diagnostic|mesurage|termites|assainissement", ["Certification COFRAC du diagnostiqueur"]),
 (r"avocat|consultation juridique|litige|divorce|succession", ["Inscription au barreau ou périmètre du droit respecté"]),
 (r"comptabilit|bilan annuel|déclaration de tva|fiches de paie", ["Inscription à l'Ordre des experts-comptables (si mission réglementée)"]),
 (r"courtage|assurance|crédit|placement", ["Immatriculation ORIAS"]),
 (r"immobili|estimation|mandat de vente|gestion locative|chasseur", ["Carte professionnelle T/G (loi Hoguet)"]),
 (r"tatouage|piercing|maquillage permanent|microblading", ["Formation hygiène et salubrité (ARS)"]),
 (r"coiffure|coupe|coloration|brushing|barbier", ["CAP coiffure ou BP (exigence d'encadrement)"]),
 (r"esthéti|épilation|soin du visage|manucure|onglerie|prothésie", ["CAP esthétique-cosmétique"]),
 (r"traiteur|chef à domicile|pâtiss|boulanger|food truck|alimentaire", ["Formation HACCP","Déclaration DDPP"]),
 (r"élagage|abattage|phytosanitaire|traitement", ["Certiphyto","Certificat de spécialisation travaux d'élagage"]),
 (r"drone", ["Attestation télépilote","Déclaration exploitant DGAC"]),
 (r"garde d'enfants de moins de 3 ans|nounou|assistante maternelle", ["Agrément / diplôme petite enfance"]),
 (r"auxiliaire de vie|aide à la toilette|garde de nuit|dépendance|alzheimer|handicap", ["DEAES ou équivalent","Déclaration SAP"]),
 (r"permis|leçon de conduite|code de la route|conduite accompagnée|stage de récupération", ["Agrément préfectoral auto-école","BEPECASER / TP ECSR"]),
 (r"dératisation|désinsectisation|punaises|termites|nid de guêpes", ["Certibiocide"]),
 (r"toiture|maçonnerie|charpente|isolation|gros œuvre|extension|fondations|mur porteur", ["Garantie décennale obligatoire"]),
 (r"panneaux solaires|photovolta|rénovation énergétique|maprimerénov", ["Qualification RGE"]),
 (r"formation|cpf|qualiopi|bilan de compétences|vae", ["Déclaration d'activité de formateur (NDA)","Certification Qualiopi si financement public"]),
 (r"obsèques|transport de corps|crémation|inhumation|rapatriement", ["Habilitation préfectorale funéraire"]),
 (r"extincteur|évacuation|désenfumage|sécurité incendie", ["Certification APSAD / qualification F4"]),
]
def regulation_for(text):
    low = text.lower()
    out = []
    for pattern, quals in REGULATED:
        if re.search(pattern, low):
            for q in quals:
                if q not in out:
                    out.append(q)
    return out

TARGET_LEAVES = 2200

# ------------------------------------------------------------- construction
def build():
    # 1) squelette : toutes les feuilles "de base"
    skeleton = []   # (cat_name, cat, cat_id, sub_name, sub_id, [bases])
    cat_n = 0
    base_count = 0
    for cat_name, cat in C.items():
        cat_n += 1
        cat_id = f"C{cat_n:02d}"
        sub_n = 0
        for sub_name, leaf_str in cat["subs"].items():
            sub_n += 1
            sub_id = f"{cat_id}.S{sub_n:02d}"
            bases = [b.strip() for b in leaf_str.split("|") if b.strip()]
            base_count += len(bases)
            skeleton.append([cat_name, cat, cat_id, sub_name, sub_id, [(b, None) for b in bases]])

    # 2) expansion contrôlée par déclinaisons jusqu'à la cible (réparti sur tout le catalogue)
    need = max(0, TARGET_LEAVES - base_count)
    round_i = 0
    while need > 0:
        progressed = False
        for entry in skeleton:
            if need <= 0:
                break
            cat = entry[1]
            bases = [l for l in entry[5] if l[1] is None]
            if round_i >= len(bases):
                continue
            b = bases[round_i][0]
            v = cat["variants"][round_i % len(cat["variants"])]
            entry[5].append((f"{b} — {v}", v))
            need -= 1
            progressed = True
        round_i += 1
        if not progressed:
            break

    # 3) matérialisation
    categories = []
    leaves_total = 0
    current_cat = None
    cat_map = {}
    for cat_name, cat, cat_id, sub_name, sub_id, leaves in skeleton:
        if cat_id not in cat_map:
            cat_map[cat_id] = {
                "id": cat_id, "slug": slug(cat_name), "label": cat_name, "level": 1,
                "icon": cat["icon"], "domain": cat["domain"],
                "default_fields": fields_for(cat["fields"], cat_name),
                "variants": cat["variants"],
                "count": 0, "children": []
            }
            categories.append(cat_map[cat_id])
        leaf_out = []
        for j, (label, variant) in enumerate(leaves, start=1):
            base_label = label.split(" — ")[0] if variant else label
            path_text = f"{cat_name} {sub_name} {label}"
            quals = regulation_for(f"{sub_name} {label}")
            leaf_out.append({
                "id": f"{sub_id}.L{j:03d}",
                "slug": slug(label),
                "label": label,
                "level": 3,
                "path": [cat_name, sub_name, label],
                "base_label": base_label,
                "variant": variant,
                "keywords": keywords(label, sub_name),
                "fields": fields_for(cat["fields"], path_text),
                "domain": cat["domain"],
                "requires_qualification": quals,
                "regulated": bool(quals),
                "pro_only": True,
            })
            leaves_total += 1
        cat_map[cat_id]["children"].append({
            "id": sub_id, "slug": slug(sub_name), "label": sub_name, "level": 2,
            "count": len(leaf_out), "children": leaf_out
        })
        cat_map[cat_id]["count"] += len(leaf_out)
    return categories, leaves_total

categories, total = build()

# ----------------------------------------------- domaines d'activité (cohérence)
# domaine principal -> catégories autorisées (strict) + adjacentes (avertissement)
ADJACENCY = {
 "beaute": ["bienetre","image","evenementiel","spectacle"],
 "bienetre": ["beaute","sante","sport","image"],
 "sante": ["bienetre","aide_personne","sport","famille"],
 "sport": ["bienetre","sante","famille","formation"],
 "famille": ["aide_personne","formation","menage","sante"],
 "aide_personne": ["famille","menage","sante","transport"],
 "menage": ["proprete","aide_personne","jardin","immobilier"],
 "proprete": ["menage","btp","immobilier","securite"],
 "btp": ["jardin","depannage","energie","immobilier","proprete"],
 "jardin": ["btp","menage","depannage","energie"],
 "depannage": ["btp","informatique","automobile","securite"],
 "informatique": ["digital","depannage","securite","formation"],
 "digital": ["informatique","audiovisuel","conseil","entreprise"],
 "audiovisuel": ["digital","evenementiel","spectacle","image"],
 "evenementiel": ["restauration","audiovisuel","spectacle","securite","transport"],
 "restauration": ["evenementiel","formation","entreprise"],
 "transport": ["automobile","evenementiel","aide_personne","entreprise"],
 "automobile": ["transport","depannage","artisanat"],
 "animaux": ["sante","famille","transport"],
 "formation": ["conseil","informatique","digital","sport","artisanat"],
 "juridique": ["conseil","immobilier","entreprise"],
 "conseil": ["juridique","digital","entreprise","formation"],
 "immobilier": ["btp","juridique","energie","menage","proprete"],
 "energie": ["btp","immobilier","automobile"],
 "securite": ["proprete","informatique","evenementiel","btp"],
 "artisanat": ["btp","image","formation","immobilier"],
 "image": ["beaute","conseil","audiovisuel","artisanat"],
 "spectacle": ["evenementiel","audiovisuel","beaute"],
 "entreprise": ["conseil","digital","juridique","proprete"],
 "funeraire": ["juridique","transport","evenementiel"],
}
DOMAIN_LABELS = {
 "beaute":"Beauté & esthétique","bienetre":"Bien-être & massage","sante":"Santé & paramédical",
 "sport":"Sport & coaching","famille":"Enfance & famille","aide_personne":"Aide à la personne",
 "menage":"Ménage à domicile","proprete":"Propreté professionnelle","btp":"Bâtiment & rénovation",
 "jardin":"Jardinage & paysage","depannage":"Dépannage & urgence","informatique":"Informatique & high-tech",
 "digital":"Web, digital & marketing","audiovisuel":"Photo, vidéo & audio","evenementiel":"Événementiel",
 "restauration":"Restauration & alimentaire","transport":"Transport & logistique","automobile":"Automobile & mobilité",
 "animaux":"Animaux","formation":"Cours & formation","juridique":"Juridique & administratif",
 "conseil":"Conseil & business","immobilier":"Immobilier & habitat","energie":"Énergie & écologie",
 "securite":"Sécurité & surveillance","artisanat":"Artisanat & sur-mesure","image":"Image & développement personnel",
 "spectacle":"Musique & spectacle","entreprise":"Services aux entreprises","funeraire":"Funéraire",
}
by_domain = {}
for c in categories:
    by_domain.setdefault(c["domain"], []).append(c["id"])

domains = []
for d, label in DOMAIN_LABELS.items():
    allowed = by_domain.get(d, [])
    adjacent = [cid for ad in ADJACENCY.get(d, []) for cid in by_domain.get(ad, [])]
    domains.append({
        "id": d, "label": label,
        "allowed_categories": allowed,
        "adjacent_categories": adjacent,
        "rule": "allow" if allowed else "review",
    })

# ------------------------------------------------------------------ sortie
doc = {
 "$schema_version": "1.0.0",
 "name": "catalogue_prestations_pro",
 "locale": "fr-FR",
 "generated_at": datetime.date.today().isoformat(),
 "description": "Taxonomie des prestations publiables par un compte PROFESSIONNEL. 3 niveaux + champs dynamiques + règles de cohérence avec le domaine d'activité déclaré du pro.",
 "stats": {
   "categories": len(categories),
   "subcategories": sum(len(c["children"]) for c in categories),
   "leaves": total,
   "fields": len(FIELDS),
   "domains": len(domains),
 },
 "coherence_policy": {
   "levels": {
     "allow": "La catégorie appartient au domaine d'activité déclaré : publication directe.",
     "review": "Catégorie adjacente au domaine : publication autorisée avec avertissement + modération légère.",
     "block": "Catégorie sans rapport avec l'activité déclarée : publication bloquée, invitation à ajouter une activité secondaire justifiée (SIRET/code APE, diplôme, assurance).",
   },
   "max_secondary_domains": 2,
   "justification_required_for_secondary": ["kbis_ou_siret","code_ape_compatible","assurance_rc_pro","diplome_si_reglemente"],
   "regulated_leaf_flag": "requires_qualification",
 },
 "field_definitions": [FIELD_INDEX[f[0]] for f in FIELDS],
 "activity_domains": domains,
 "categories": categories,
}

with open(os.path.join(OUT_DIR,"catalogue_prestations_pro.json"),"w",encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)

# index plat pour l'autosuggestion (léger, à charger côté app)
flat = []
for c in categories:
    for s in c["children"]:
        for l in s["children"]:
            flat.append({
                "id": l["id"], "label": l["label"], "cat": c["label"], "sub": s["label"],
                "domain": c["domain"], "slug": l["slug"], "kw": l["keywords"], "f": l["fields"],
                "reg": 1 if l["regulated"] else 0,
            })
with open(os.path.join(OUT_DIR,"autosuggest_index.json"),"w",encoding="utf-8") as f:
    json.dump({"version":"1.0.0","count":len(flat),"items":flat}, f, ensure_ascii=False)

print("categories:", len(categories))
print("subcategories:", sum(len(c['children']) for c in categories))
print("leaves:", total)
