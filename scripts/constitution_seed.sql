-- Seed script for the Constitution of the Order

DELETE FROM law_sections WHERE document_type = 'constitution';

INSERT INTO law_sections (document_type, article_number, section_number, title, content) VALUES
('constitution', 'I', '1', 'The Sovereign Mandate', '<p>The supreme authority of the Sith Order is permanently and unconditionally vested in High Command. They are the ultimate arbiters of the Order''s destiny, and their will is the absolute law from which there is no appeal.</p>'),
('constitution', 'I', '2', 'The Emperor''s Wrath', '<p>The Emperor''s Wrath is the unbroken sword of the Throne. To them is granted supreme and unquestionable dominion over all Divisions and martial forces within the Order. Their command over the military apparatus supersedes all, save the Emperor themselves.</p>'),
('constitution', 'I', '3', 'The Emperor''s Voice', '<p>The Emperor''s Voice speaks with the authority of the Sovereign. To them is granted supreme oversight, governance, and supremacy over the Dark Council, ensuring that the legislative body remains forever aligned with the Emperor''s grand design.</p>'),

('constitution', 'II', '1', 'The Governing Body', '<p>The Dark Council serves as the supreme legislative body of the Order. It is their sacred duty to forge the laws of the Empire, to deliberate upon matters of state, and to ensure the rigid structure of Sith society is maintained through official decrees and the judgment of Kaggaths.</p>'),
('constitution', 'II', '2', 'The Right of Amendment', '<p>No law is eternal save the Emperor''s word. This Constitution and the Sith Codex may be amended only through formal legislation drafted upon the Council Floor. Such proposals require a majority consensus of the Council to pass, yet remain forever subject to the absolute and final veto of High Command.</p>'),

('constitution', 'III', '1', 'Charter: The Dark Honor Guard', '<p>The Dark Honor Guard stands as the indomitable shield of the Empire. Darth Mortis shall retain absolute and unquestioned authority over the Guard, superseded only by the Emperor''s Wrath. It is their eternal mandate to police the Order and defend High Command at the cost of their very lives.</p>'),
('constitution', 'III', '2', 'Charter: The Dread Masters', '<p>The Dread Masters are the masters of terror and the architects of madness. Darth Nox shall retain absolute authority over their ranks, superseded only by the Emperor''s Wrath. They are the practitioners of dark alchemy and psychological warfare, striking fear into the hearts of all who oppose the Order.</p>'),
('constitution', 'III', '3', 'Charter: The Reavers', '<p>The Reavers are the vanguard of destruction. Darth Baras shall retain absolute authority over their forces, superseded only by the Emperor''s Wrath. They act as the primary offensive spearhead and elite assassins of the Sith Order, eliminating threats with ruthless and silent efficiency.</p>'),

('constitution', 'IV', '1', 'The Foundations of Legacy', '<p>A Sith''s bloodline is a testament to their strength, ambition, and enduring legacy. To be formally recognized as an official Bloodline within the Order, the lineage must boast ten named conscripts, five of whom must maintain active and honorable service. The Emperor and the Owner of the Order shall act as the ultimate judges of a bloodline''s standing, and any bloodline that moves against the Order shall face swift eradication.</p>'),

('constitution', 'V', '1', 'Ratification & Signatures', '
<p style="font-style: italic; margin-bottom: 2rem;">Only the strong shall inherit the stars. By my Authority and Hand, in Mind and Will:</p>
<div style="font-family: ''Great Vibes'', cursive; font-size: 2.5rem; color: var(--color-brand); margin-bottom: 0.5rem;">Vyberon</div>
<div style="font-family: ''Great Vibes'', cursive; font-size: 2.5rem; color: var(--color-brand);">[Insert Council Signatures Here]</div>
');
