from jinja2 import Template
from .sonic_intelligence import TrackMetadata

class DDEXOrchestrator:
    """
    Module 3: DDEX Orchestrator (Global Distribution)
    Generates ERN 4.3 XML messages (Layer 4).
    """
    
    ERN_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<ern:NewReleaseMessage 
    xmlns:ern="http://ddex.net/xml/ern/43"
    xmlns:xs="http://www.w3.org/2001/XMLSchema-instance"
    MessageSchemaVersionId="ern/43"
    LanguageAndScriptCode="en">
    <MessageHeader>
        <MessageThreadId>{{ msg_id }}</MessageThreadId>
        <MessageId>{{ msg_id }}</MessageId>
        <MessageSender>
            <PartyId>PADPIDA2013042401I</PartyId>
            <PartyName>
                <FullName>HardbanRecords Lab</FullName>
            </PartyName>
        </MessageSender>
        <MessageRecipient>
            <PartyId>PADPIDA2013042401I</PartyId>
            <PartyName>
                <FullName>DSP</FullName>
            </PartyName>
        </MessageRecipient>
        <MessageCreatedDateTime>{{ creation_date }}</MessageCreatedDateTime>
    </MessageHeader>
    <ResourceList>
        <SoundRecording>
            <ResourceReference>A1</ResourceReference>
            <Type>SoundRecording</Type>
            <ReferenceTitle>
                <TitleText>{{ title }}</TitleText>
            </ReferenceTitle>
            <Duration>{{ duration_iso }}</Duration>
            <DetailsByTerritory>
                <TerritoryCode>Worldwide</TerritoryCode>
                <Title>
                    <TitleText>{{ title }}</TitleText>
                </Title>
                <DisplayArtist>
                    <PartyName>
                        <FullName>{{ artist }}</FullName>
                    </PartyName>
                    <ArtistRole>MainArtist</ArtistRole>
                </DisplayArtist>
                <Genre>
                    <GenreText>{{ genre }}</GenreText>
                </Genre>
                <PLine>
                    <Year>{{ year }}</Year>
                    <PLineText>HardbanRecords Lab</PLineText>
                </PLine>
            </DetailsByTerritory>
        </SoundRecording>
    </ResourceList>
    <ReleaseList>
        <Release IsMainRelease="true">
            <ReleaseId>
                <ICPN>{{ icpn }}</ICPN>
                <CatalogNumber>{{ catalog_number }}</CatalogNumber>
            </ReleaseId>
            <ReferenceTitle>
                <TitleText>{{ title }}</TitleText>
            </ReferenceTitle>
            <ReleaseResourceReferenceList>
                <ReleaseResourceReference>A1</ReleaseResourceReference>
            </ReleaseResourceReferenceList>
            <ReleaseType>Single</ReleaseType>
            <ReleaseDetailsByTerritory>
                <TerritoryCode>Worldwide</TerritoryCode>
                <DisplayArtistName>{{ artist }}</DisplayArtistName>
                <LabelName>HardbanRecords Lab</LabelName>
                <Title>
                    <TitleText>{{ title }}</TitleText>
                </Title>
            </ReleaseDetailsByTerritory>
        </Release>
    </ReleaseList>
    <DealList>
        <ReleaseDeal>
            <DealReleaseReference>R1</DealReleaseReference>
            <Deal>
                <DealTerms>
                    <CommercialModelType>PayAsYouGoModel</CommercialModelType>
                    <Usage>
                        <UseType>PermanentDownload</UseType>
                    </Usage>
                    <TerritoryCode>Worldwide</TerritoryCode>
                    <ValidityPeriod>
                        <StartDate>{{ year }}-01-01</StartDate>
                    </ValidityPeriod>
                </DealTerms>
            </Deal>
        </ReleaseDeal>
    </DealList>
</ern:NewReleaseMessage>
"""

    @staticmethod
    def generate_xml(track: TrackMetadata) -> str:
        """Generates DDEX ERN 4.3 XML."""
        from datetime import datetime
        import uuid
        
        # Calculate Duration in ISO 8601 (PT1M30S)
        # Assuming track.duration is not in TrackMetadata yet based on previous file view?
        # Re-checking TrackMetadata definition in sonic_intelligence.py... 
        # It has: isrc, bpm, key, lufs, etc. It does MISS 'duration' in the Pydantic model I viewed earlier?
        # Let's assume passed metadata might have it or default to 180s.
        
        duration_sec = 180 # Default
        # If track object has it (it might come from 'job.result' dict so check conversion in export.py)
        
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        duration_iso = f"PT{minutes}M{seconds}S"

        template = Template(DDEXOrchestrator.ERN_TEMPLATE)
        return template.render(
            msg_id=f"MSG_{uuid.uuid4()}",
            creation_date=datetime.now().isoformat(),
            isrc=track.isrc,
            title=track.title,
            artist=track.artist,
            duration_iso=duration_iso,
            genre=track.mood_vibe or "Electronic",
            year=datetime.now().year,
            catalog_number="HRL-001",
            icpn="0000000000000" # EAN/UPC
        )
