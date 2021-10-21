import { expect } from "chai";

/**
 * Tests assume the following blockchain state:
 * - #0 complete
 * - #1 complete
 * - #2 with 2 lines
 * - #3 with 50 lines but no grant
 */
const MAX_LINES = 50;

it('tells about', () => {
  cy.visit('http://localhost:4000/about');
  cy.get('h2').should('have.text', 'FAQ');
});

describe('index', () => {
  beforeEach(() => {
    cy.visit('http://localhost:4000')
  });

  it('displays home', () => {
      cy.get('h1').should('have.text', 'Expensive Lines');
  });

  it('sees artwork #0', () => {
    cy.get('#main svg > line').should('have.length', 50);
    cy.get('#status #artworkId').should('have.text', '#0');
    cy.contains('#status #lineCount', 'of').invoke('text').then((text) => {
      expect(text).to.equal('50 of 50');
    })
    cy.contains('#status #cost', 'Ether').invoke('text').then((text) => {
      expect(parseFloat(text)).to.be.greaterThan(0.00001)
    });
    cy.get('#status #state').should('have.text', 'Completed');
    cy.contains('#status #leadArtist', '0x').invoke('text').then((text) => {
      expect(text.length).to.equal(42);
    });
    cy.get('#status #linesByLeader').should('have.text', '50');
    cy.contains('#status #grantee', '0x').invoke('text').then((text) => {
      expect(text.length).to.equal(42);
    });
  });
});

describe('artwork (historical)', () => {
  it('does not show when does not exist', () => {
    cy.visit('http://localhost:4000/artwork?id=4096');
    cy.get('#status #state').should('have.text', 'Artwork does not exist.');
  });

  it('shows #1 as completed', () => {
    cy.visit('http://localhost:4000/artwork?id=1');
    cy.get('#main svg > line').should('have.length', 50);
    cy.get('#status #artworkId').should('have.text', '#1');
    cy.contains('#status #cost', 'Ether').invoke('text').then((text) => {
      expect(parseFloat(text)).to.be.greaterThan(0.0001)
    });
    cy.get('#status #state').should('have.text', 'Completed');
    cy.contains('#status #grantee', '0x').invoke('text').then((text) => {
      expect(text.length).to.equal(42);
    });
  });

  it('shows #2 as in progress with 2 lines', () => {
    cy.visit('http://localhost:4000/artwork?id=2');
    cy.get('#main svg > line').should('have.length', 2);
    cy.get('#status #artworkId').should('have.text', '#2');
    cy.get('#status #state').should('have.text', 'In progress');
  });

  it('shows #3 as in grant period', () => {
    cy.visit('http://localhost:4000/artwork?id=3');
    cy.get('#main svg > line').should('have.length', 50);
    cy.get('#status #artworkId').should('have.text', '#3');
    cy.get('#status #state').should('have.text', 'In grant period');
  });
  
  
});