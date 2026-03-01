
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Any

def generate_ddex_ern_xml(metadata: Dict[str, Any]) -> str:
    """
    Generates a simplified DDEX ERN 3.8 XML message from track metadata.
    """
    # Namespaces
    ern = "http://ddex.net/xml/ern/382"
    xsi = "http://www.w3.org/2001/XMLSchema-instance"
    
    ET.register_namespace('', ern)
    ET.register_namespace('xsi', xsi)
    
    # Root Element
    root = ET.Element(f"{{{ern}}}NewReleaseMessage")
    root.set(f"{{{xsi}}}schemaLocation", f"{ern} http://ddex.net/xml/ern/382/release-notification.xsd")
    root.set("MessageSchemaVersionId", "20150616")
    root.set("LanguageAndScriptCode", "en")

    # Message Header
    header = ET.SubElement(root, "MessageHeader")
    ET.SubElement(header, "MessageThreadId").text = f"MME-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    ET.SubElement(header, "MessageId").text = f"MSG-{metadata.get('isrc', 'TEMP')}"
    
    sender = ET.SubElement(header, "MessageSender")
    ET.SubElement(sender, "PartyId").text = "PADPIDA20250101-01"
    party_name = ET.SubElement(sender, "PartyName")
    ET.SubElement(party_name, "FullName").text = "Music Metadata Engine"
    
    ET.SubElement(header, "SentOnBehalfOf").text = metadata.get("artist", "Independent Artist")
    ET.SubElement(header, "MessageCreatedDateTime").text = datetime.now().isoformat()

    # Resource List
    resource_list = ET.SubElement(root, "ResourceList")
    sound_recording = ET.SubElement(resource_list, "SoundRecording")
    
    # Sound Recording Details
    ET.SubElement(sound_recording, "SoundRecordingType").text = "UserDefined"
    
    id_node = ET.SubElement(sound_recording, "SoundRecordingId")
    ET.SubElement(id_node, "ISRC").text = metadata.get("isrc", "")
    
    resource_ref = ET.SubElement(sound_recording, "ResourceReference")
    resource_ref.text = "A1"
    
    title_node = ET.SubElement(sound_recording, "ReferenceTitle")
    ET.SubElement(title_node, "TitleText").text = metadata.get("title", "Unknown Title")
    
    # Release List
    release_list = ET.SubElement(root, "ReleaseList")
    release = ET.SubElement(release_list, "Release")
    
    release_id = ET.SubElement(release, "ReleaseId")
    ET.SubElement(release_id, "ICPN").text = metadata.get("upc", "")
    
    release_ref = ET.SubElement(release, "ReleaseReference")
    release_ref.text = "R1"
    
    release_title = ET.SubElement(release, "ReferenceTitle")
    ET.SubElement(release_title, "TitleText").text = metadata.get("album", metadata.get("title", "Unknown Album"))
    
    # Deal List (Simplified Release Permissions)
    deal_list = ET.SubElement(root, "DealList")
    release_deal = ET.SubElement(deal_list, "ReleaseDeal")
    ET.SubElement(release_deal, "ReleaseReference").text = "R1"
    
    deal = ET.SubElement(release_deal, "Deal")
    usage = ET.SubElement(deal, "Usage")
    ET.SubElement(usage, "UseType").text = "Stream"
    ET.SubElement(usage, "UseType").text = "Download"
    
    territory = ET.SubElement(deal, "TerritoryCode")
    territory.text = "Worldwide"

    # Convert to string
    xml_str = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_str.decode("utf-8")
