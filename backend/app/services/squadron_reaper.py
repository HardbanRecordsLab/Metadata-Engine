from jinja2 import Template
from datetime import datetime
from .sonic_intelligence import TrackMetadata

class SquadronReaper:
    """
    Module 2: Squadron Reaper (Monetization & Recovery)
    Automated demand letter generation (Layer 7).
    """
    
    DEMAND_LETTER_TEMPLATE = """
    DO: {{ entity_name }}
    DOTYCZY: Naruszenie praw autorskich / Brak rozliczenia tantiem (ISRC: {{ isrc }})
    DATA: {{ date }}
    
    Niniejszym wzywamy do natychmiastowego uregulowania zaległości dla utworu:
    TYTUŁ: {{ title }}
    ARTYSTA: {{ artist }}
    
    Analiza systemu HardbanRecords OS wykazała brak raportowania przychodów z terytoriów globalnych.
    Szacowana kwota roszczenia: {{ estimated_amount }} USD.
    
    W przypadku braku wpłaty w ciągu 7 dni roboczych, system automatycznie 
    uruchomi protokół arbitrażu i blokadę dystrybucyjną Twoich katalogów.
    
    Z poważaniem,
    HardbanRecords Legal Automaton
    """

    @staticmethod
    def generate_demand(track: TrackMetadata, entity: str, amount: float) -> str:
        """Generates a legal demand letter."""
        template = Template(SquadronReaper.DEMAND_LETTER_TEMPLATE)
        return template.render(
            entity_name=entity,
            date=datetime.now().strftime("%Y-%m-%d"),
            title=track.title,
            artist=track.artist,
            isrc=track.isrc,
            estimated_amount=f"{amount:,.2f}"
        )
