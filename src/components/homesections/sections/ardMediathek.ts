import type { SectionOptions } from './section';

export function loadArdMediathek(
    elem: HTMLElement,
    { enableOverflow }: SectionOptions
) {
    let html = '';

    elem.classList.remove('verticalSection');

    html += '<div class="verticalSection verticalSection-extrabottompadding">';
    html += '<h2 class="sectionTitle sectionTitle-cards padded-left">ARD Mediathek</h2>';

    html += enableOverflow
        ? '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true"><div class="itemsContainer scrollSlider focuscontainer-x">'
        : '<div class="itemsContainer padded-left padded-right vertical-wrap focuscontainer-x">';

    html += '<a is="emby-linkbutton" href="#/ardhome" class="raised homeLibraryButton homeLibraryButton-ard">';
    html += '<span class="material-icons homeLibraryIcon ondemand_video" aria-hidden="true"></span>';
    html += '<span class="homeLibraryText">ARD Mediathek</span>';
    html += '</a>';

    html += '</div>';
    if (enableOverflow) {
        html += '</div>';
    }
    html += '</div>';

    elem.innerHTML = html;
}
