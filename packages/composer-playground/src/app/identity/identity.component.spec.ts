/* tslint:disable:no-unused-variable */
/* tslint:disable:no-unused-expression */
/* tslint:disable:no-var-requires */
/* tslint:disable:max-classes-per-file */
import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { IdentityComponent } from './identity.component';
import { AlertService } from '../basic-modals/alert.service';
import { ClientService } from '../services/client.service';
import { IdentityCardService } from '../services/identity-card.service';
import { BusinessNetworkConnection } from 'composer-client';
import { IdCard } from 'composer-common';

import * as fileSaver from 'file-saver';

import * as chai from 'chai';

import * as sinon from 'sinon';

let should = chai.should();

@Component({
    selector: 'app-footer',
    template: ''
})
class MockFooterComponent {

}

describe(`IdentityComponent`, () => {

    let component: IdentityComponent;
    let fixture: ComponentFixture<IdentityComponent>;

    let mockModal;
    let mockAlertService;
    let mockIdentityCardService;
    let mockClientService;
    let mockBusinessNetworkConnection;
    let mockCard;
    let mockIDCards: Map<string, IdCard>;

    beforeEach(() => {

        mockCard = sinon.createStubInstance(IdCard);
        mockCard.getBusinessNetworkName.returns('myNetwork');
        mockCard.getConnectionProfile.returns({name: 'myProfile'});
        mockCard.getName.returns('myName');

        mockIDCards = new Map<string, IdCard>();
        mockIDCards.set('1234', mockCard);

        mockModal = sinon.createStubInstance(NgbModal);
        mockAlertService = sinon.createStubInstance(AlertService);
        mockIdentityCardService = sinon.createStubInstance(IdentityCardService);
        mockClientService = sinon.createStubInstance(ClientService);
        mockBusinessNetworkConnection = sinon.createStubInstance(BusinessNetworkConnection);

        mockAlertService.errorStatus$ = {next: sinon.stub()};
        mockAlertService.successStatus$ = {next: sinon.stub()};
        mockAlertService.busyStatus$ = {next: sinon.stub()};

        mockClientService.ensureConnected.returns(Promise.resolve(true));
        mockBusinessNetworkConnection.getIdentityRegistry.returns(Promise.resolve({
            getAll: sinon.stub().returns([{name: 'idOne'}, {name: 'idTwo'}])
        }));
        mockClientService.getBusinessNetworkConnection.returns(mockBusinessNetworkConnection);

        mockClientService.getMetaData.returns({
            getName: sinon.stub().returns('name')
        });

        TestBed.configureTestingModule({
            imports: [FormsModule],
            declarations: [
                IdentityComponent,
                MockFooterComponent
            ],
            providers: [
                {provide: NgbModal, useValue: mockModal},
                {provide: AlertService, useValue: mockAlertService},
                {provide: ClientService, useValue: mockClientService},
                {provide: IdentityCardService, useValue: mockIdentityCardService},
            ]
        });

        fixture = TestBed.createComponent(IdentityComponent);

        component = fixture.componentInstance;
    });

    describe('ngOnInit', () => {
        it('should create the component', () => {
            component.should.be.ok;
        });

        it('should load the component', fakeAsync(() => {
            let loadMock = sinon.stub(component, 'loadAllIdentities').returns(Promise.resolve());

            component.ngOnInit();

            tick();

            loadMock.should.have.been.called;
        }));
    });

    describe('load all identities', () => {
        it('should load the identities', fakeAsync(() => {
            mockClientService.getMetaData.returns({getName: sinon.stub().returns('myNetwork')});
            let myIdentityMock = sinon.stub(component, 'loadMyIdentities');

            mockIdentityCardService.getCurrentIdentityCard.returns({
                getConnectionProfile: sinon.stub().returns({name: 'myProfile'})
            });

            mockIdentityCardService.getQualifiedProfileName.returns('qpn');
            mockIdentityCardService.getCardRefFromIdentity.onFirstCall().returns('1234');
            mockIdentityCardService.getCardRefFromIdentity.onSecondCall().returns('4321');

            component.loadAllIdentities();

            tick();

            component['businessNetworkName'].should.equal('myNetwork');
            myIdentityMock.should.have.been.called;

            mockIdentityCardService.getCurrentIdentityCard.should.have.been.called;
            mockIdentityCardService.getQualifiedProfileName.should.have.been.calledWith({name : 'myProfile'});
            mockIdentityCardService.getCardRefFromIdentity.should.have.been.calledTwice;
            mockIdentityCardService.getCardRefFromIdentity.firstCall.should.have.been.calledWith('idOne', 'myNetwork', 'qpn');
            mockIdentityCardService.getCardRefFromIdentity.secondCall.should.have.been.calledWith('idTwo', 'myNetwork', 'qpn');
            component['allIdentities'].should.deep.equal([{name: 'idOne', ref : '1234'}, {name: 'idTwo', ref: '4321'}]);
        }));

        it('should give an alert if there is an error', fakeAsync(() => {

            mockBusinessNetworkConnection.getIdentityRegistry.returns(Promise.reject('some error'));
            let myIdentityMock = sinon.stub(component, 'loadMyIdentities');

            component.loadAllIdentities();

            tick();

            myIdentityMock.should.have.been.called;
            mockBusinessNetworkConnection.getIdentityRegistry.should.have.been.called;

            mockAlertService.errorStatus$.next.should.have.been.calledWith('some error');
        }));
    });

    describe('loadMyIdentities', () => {
        it('should load identities for a business network', () => {
            mockIdentityCardService.currentCard = '1234';

            mockIdentityCardService.getCurrentIdentityCard.returns(mockCard);
            mockIdentityCardService.getQualifiedProfileName.returns('web-profile');

            mockIdentityCardService.getAllCardsForBusinessNetwork.returns(mockIDCards);

            component.loadMyIdentities();

            component['currentIdentity'].should.equal('1234');
            mockIdentityCardService.getCurrentIdentityCard.should.have.been.calledTwice;

            mockCard.getBusinessNetworkName.should.have.been.called;
            mockCard.getConnectionProfile.should.have.been.called;

            mockIdentityCardService.getQualifiedProfileName.should.have.been.calledWith({name: 'myProfile'});

            mockIdentityCardService.getAllCardsForBusinessNetwork.should.have.been.calledWith('myNetwork', 'web-profile');
            component['identityCards'].should.deep.equal(mockIDCards);

            component['cardRefs'].should.deep.equal(['1234']);
        });
    });

    describe('issueNewId', () => {
        let mockGetConnectionProfile;
        let mockLoadAllIdentities;
        let mockAddIdentityToWallet;
        let mockShowNewId;

        beforeEach(() => {
            mockModal.open.reset();

            mockGetConnectionProfile = sinon.stub();

            mockIdentityCardService.getCurrentIdentityCard.returns({
                getConnectionProfile: mockGetConnectionProfile
            });

            mockLoadAllIdentities = sinon.stub(component, 'loadAllIdentities');
            mockAddIdentityToWallet = sinon.stub(component, 'addIdentityToWallet');
            mockShowNewId = sinon.stub(component, 'showNewId');
        });

        it('should show the new id', fakeAsync(() => {
            mockGetConnectionProfile.returns({
                type: 'hlfv1'
            });

            mockModal.open.returns({
                result: Promise.resolve({userID: 'myId', userSecret: 'mySecret'})
            });

            component.issueNewId();

            tick();

            mockAddIdentityToWallet.should.not.have.been.called;
            mockShowNewId.should.have.been.called;
            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should add id to wallet when using the web profile', fakeAsync(() => {
            mockGetConnectionProfile.returns({
                type: 'web'
            });

            mockModal.open.returns({
                result: Promise.resolve({userID: 'myId', userSecret: 'mySecret'})
            });

            component.issueNewId();

            tick();

            mockAddIdentityToWallet.should.have.been.called;
            mockShowNewId.should.not.have.been.called;
            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should handle error in id creation', fakeAsync(() => {
            mockModal.open.returns({
                result: Promise.reject('some error')
            });

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            component.issueNewId();

            tick();

            mockModal.open.should.have.been.calledOnce;

            mockAlertService.errorStatus$.next.should.have.been.calledWith('some error');

            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should handle error showing new identity', fakeAsync(() => {
            mockGetConnectionProfile.returns({
                type: 'hlfv1'
            });

            mockModal.open.returns({
                result: Promise.resolve({userID: 'myId', userSecret: 'mySecret'})
            });

            mockShowNewId.rejects(new Error('show new id error'));

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            component.issueNewId();

            tick();

            mockModal.open.should.have.been.calledOnce;

            let expectedError = sinon.match(sinon.match.instanceOf(Error).and(sinon.match.has('message', 'show new id error')));
            mockAlertService.errorStatus$.next.should.have.been.calledWith(expectedError);

            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should handle error adding identity to wallet', fakeAsync(() => {
            mockGetConnectionProfile.returns({
                type: 'web'
            });

            mockModal.open.returns({
                result: Promise.resolve({userID: 'myId', userSecret: 'mySecret'})
            });

            mockAddIdentityToWallet.rejects(new Error('add identity to wallet error'));

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            component.issueNewId();

            tick();

            mockModal.open.should.have.been.calledOnce;

            let expectedError = sinon.match(sinon.match.instanceOf(Error).and(sinon.match.has('message', 'add identity to wallet error')));
            mockAlertService.errorStatus$.next.should.have.been.calledWith(expectedError);

            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should handle error reloading identities', fakeAsync(() => {
            mockModal.open.returns({
                result: Promise.resolve({userID: 'myId', userSecret: 'mySecret'})
            });

            mockLoadAllIdentities.returns(Promise.reject('some error'));

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            component.issueNewId();

            tick();

            mockModal.open.should.have.been.calledOnce;

            mockAlertService.errorStatus$.next.should.have.been.calledWith('some error');

            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should handle escape being pressed', fakeAsync(() => {
            mockModal.open.returns({
                result: Promise.reject(1)
            });

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            component.issueNewId();

            tick();

            mockModal.open.should.have.been.calledOnce;

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            mockLoadAllIdentities.should.have.been.called;
        }));

        it('should not issue identity if cancelled', fakeAsync(() => {
            mockModal.open.returns({
                result: Promise.resolve()
            });

            mockAlertService.errorStatus$.next.should.not.have.been.called;

            component.issueNewId();

            tick();

            mockAlertService.errorStatus$.next.should.not.have.been.called;
            mockLoadAllIdentities.should.have.been.called;

        }));
    });

    describe('showNewId', () => {
        let mockAddCardToWallet;
        let mockExportIdentity;

        beforeEach(() => {
            mockModal.open.reset();

            mockAddCardToWallet = sinon.stub(component, 'addCardToWallet');
            mockExportIdentity = sinon.stub(component, 'exportIdentity');
        });

        it('should add card to wallet when add option selected', fakeAsync(() => {
            mockModal.open.returns({
                componentInstance: {},
                result: Promise.resolve({card: 'myCard', choice: 'add'})
            });

            component.showNewId({userID: 'myId', userSecret: 'mySecret'});

            tick();

            mockModal.open.should.have.been.called;
            mockAddCardToWallet.should.have.been.calledWith('myCard');
            mockExportIdentity.should.not.have.been.called;
        }));

        it('should export card when export option selected', fakeAsync(() => {
            mockModal.open.returns({
                componentInstance: {},
                result: Promise.resolve({card: 'myCard', choice: 'export'})
            });

            component.showNewId({userID: 'myId', userSecret: 'mySecret'});

            tick();

            mockModal.open.should.have.been.called;
            mockAddCardToWallet.should.not.have.been.called;
            mockExportIdentity.should.have.been.calledWith('myCard');
        }));

        it('should do nothing for other options', fakeAsync(() => {
            mockModal.open.returns({
                componentInstance: {},
                result: Promise.resolve({card: 'myCard', choice: 'other'})
            });

            component.showNewId({userID: 'myId', userSecret: 'mySecret'});

            tick();

            mockModal.open.should.have.been.called;
            mockAddCardToWallet.should.not.have.been.called;
            mockExportIdentity.should.not.have.been.called;
        }));

        it('should do nothing when closed', fakeAsync(() => {
            mockModal.open.returns({
                componentInstance: {},
                result: Promise.resolve()
            });

            component.showNewId({userID: 'myId', userSecret: 'mySecret'});

            tick();

            mockModal.open.should.have.been.called;
            mockAddCardToWallet.should.not.have.been.called;
            mockExportIdentity.should.not.have.been.called;
        }));
    });

    describe('addCardToWallet', () => {
        it('should add idcard to wallet', fakeAsync(() => {
            mockIdentityCardService.addIdentityCard.returns(Promise.resolve('cardref'));
            mockIdentityCardService.getIdentityCard.returns(mockCard);

            component.addCardToWallet(mockCard);

            tick();

            mockIdentityCardService.addIdentityCard.should.have.been.calledWith(mockCard);
            mockIdentityCardService.getIdentityCard.should.have.been.calledWith('cardref');
            mockAlertService.successStatus$.next.should.have.been.calledWith({
                title: 'ID Card added to wallet',
                text: 'The ID card myName was successfully added to your wallet',
                icon: '#icon-role_24'
            });
        }));
    });

    describe('addIdentityToWallet', () => {
        it('should add identity to wallet', fakeAsync(() => {
            mockIdentityCardService.getCurrentIdentityCard.returns(mockCard);
            mockIdentityCardService.createIdentityCard.returns(Promise.resolve('cardref'));
            mockIdentityCardService.getIdentityCard.returns(mockCard);

            component.addIdentityToWallet({userID: 'myName', userSecret: 'mySecret'});

            tick();

            mockIdentityCardService.createIdentityCard.should.have.been.calledWith('myName', 'myNetwork', 'myName', 'mySecret', {name: 'myProfile'});
            mockIdentityCardService.getIdentityCard.should.have.been.calledWith('cardref');
            mockAlertService.successStatus$.next.should.have.been.calledWith({
                title: 'ID Card added to wallet',
                text: 'The ID card myName was successfully added to your wallet',
                icon: '#icon-role_24'
            });
        }));
    });

    describe('exportIdentity', () => {
        let sandbox = sinon.sandbox.create();
        let saveAsStub;

        beforeEach(() => {
            saveAsStub = sandbox.stub(fileSaver, 'saveAs');
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('should export idcard', fakeAsync(() => {
            mockCard.toArchive.returns(Promise.resolve('card data'));

            component.exportIdentity(mockCard);

            tick();

            let expectedFile = new Blob(['card data'], {type: 'application/octet-stream'});
            saveAsStub.should.have.been.calledWith(expectedFile, 'myName.card');
        }));
    });

    describe('setCurrentIdentity', () => {
        it('should set the current identity', fakeAsync(() => {
            let loadAllIdentities = sinon.stub(component, 'loadAllIdentities');
            mockIdentityCardService.setCurrentIdentityCard.returns(Promise.resolve());
            mockClientService.ensureConnected.returns(Promise.resolve());

            component.setCurrentIdentity('1234');

            tick();

            component['currentIdentity'].should.equal('1234');
            mockIdentityCardService.setCurrentIdentityCard.should.have.been.calledWith('1234');
            mockClientService.ensureConnected.should.have.been.calledWith(null, true);
            mockAlertService.busyStatus$.next.should.have.been.calledTwice;
            loadAllIdentities.should.have.been.called;
        }));

        it('should do nothing if the new identity matches the current identity', fakeAsync(() => {
            let loadAllIdentities = sinon.stub(component, 'loadAllIdentities');
            component['currentIdentity'] = '1234';

            component.setCurrentIdentity('1234');

            tick();

            component['currentIdentity'].should.equal('1234');
            loadAllIdentities.should.not.have.been.called;
            mockIdentityCardService.setCurrentIdentityCard.should.not.have.been.called;
            mockClientService.ensureConnected.should.not.have.been.called;
            mockAlertService.busyStatus$.next.should.not.have.been.called;
        }));

        it('should handle errors', fakeAsync(() => {
            mockClientService.ensureConnected.returns(Promise.reject('Testing'));
            mockIdentityCardService.setCurrentIdentityCard.returns(Promise.resolve());
            component.setCurrentIdentity('1234');

            tick();

            mockAlertService.busyStatus$.next.should.have.been.calledTwice;
            mockAlertService.busyStatus$.next.should.have.been.calledWith(null);
            mockAlertService.errorStatus$.next.should.have.been.called;
        }));
    });

    describe('removeIdentity', () => {
        it('should open the delete-confirm modal', fakeAsync(() => {
            component['identityCards'] = mockIDCards;
            let loadMock = sinon.stub(component, 'loadAllIdentities');

            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve()
            });

            component.removeIdentity('1234');
            tick();

            mockModal.open.should.have.been.called;
        }));

        it('should open the delete-confirm modal and handle error', fakeAsync(() => {
            component['identityCards'] = mockIDCards;
            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.reject('some error')
            });

            component.removeIdentity('1234');
            tick();

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.errorStatus$.next.should.have.been.called;
        }));

        it('should open the delete-confirm modal and handle cancel', fakeAsync(() => {
            component['identityCards'] = mockIDCards;
            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.reject(null)
            });

            component.removeIdentity('1234');
            tick();

            mockAlertService.busyStatus$.next.should.not.have.been.called;
            mockAlertService.errorStatus$.next.should.not.have.been.called;
        }));

        it('should remove the identity from the wallet', fakeAsync(() => {
            component['identityCards'] = mockIDCards;
            mockIdentityCardService.deleteIdentityCard.returns(Promise.resolve());

            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve(true)
            });

            let mockLoadAllIdentities = sinon.stub(component, 'loadAllIdentities');

            component.removeIdentity('1234');

            tick();

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockIdentityCardService.deleteIdentityCard.should.have.been.calledWith('1234');
            mockLoadAllIdentities.should.have.been.called;

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.successStatus$.next.should.have.been.called;
            mockAlertService.errorStatus$.next.should.not.have.been.called;
        }));

        it('should handle error when removing from wallet', fakeAsync(() => {
            component['identityCards'] = mockIDCards;
            mockIdentityCardService.deleteIdentityCard.returns(Promise.reject('some error'));

            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve(true)
            });

            let mockLoadAllIdentities = sinon.stub(component, 'loadAllIdentities');

            component.removeIdentity('1234');

            tick();

            mockIdentityCardService.deleteIdentityCard.should.have.been.calledWith('1234');
            mockLoadAllIdentities.should.not.have.been.called;

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.errorStatus$.next.should.have.been.calledWith('some error');
        }));
    });

    describe('revokeIdentity', () => {
        it('should open the delete-confirm modal', fakeAsync(() => {

            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve()
            });

            component.revokeIdentity({name: 'fred'});
            tick();

            mockModal.open.should.have.been.called;
        }));

        it('should open the delete-confirm modal and handle error', fakeAsync(() => {

            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.reject('some error')
            });

            component.revokeIdentity({name: 'fred'});
            tick();

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.errorStatus$.next.should.have.been.called;
        }));

        it('should open the delete-confirm modal and handle cancel', fakeAsync(() => {

            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.reject(null)
            });

            component.revokeIdentity({name: 'fred'});
            tick();

            mockAlertService.busyStatus$.next.should.not.have.been.called;
            mockAlertService.errorStatus$.next.should.not.have.been.called;
        }));

        it('should revoke the identity from the client service and then remove the identity from the wallet if in wallet', fakeAsync(() => {
            component['cardRefs'] = ['1234'];
            component['businessNetworkName'] = 'myNetwork';
            component['myIdentities'] = ['fred'];
            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve(true)
            });

            mockClientService.revokeIdentity.returns(Promise.resolve());

            let mockRemoveIdentity = sinon.stub(component, 'removeIdentity').returns(Promise.resolve());
            let mockLoadAllIdentities = sinon.stub(component, 'loadAllIdentities').returns(Promise.resolve());

            component.revokeIdentity({name: 'fred', ref: '1234'});

            tick();

            mockClientService.revokeIdentity.should.have.been.called;
            mockRemoveIdentity.should.have.been.calledWith('1234');
            mockLoadAllIdentities.should.have.been.called;

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.successStatus$.next.should.have.been.called;
        }));

        it('should revoke the identity from the client service not remove from wallet', fakeAsync(() => {
            component['cardRefs'] = [];
            component['businessNetworkName'] = 'myNetwork';
            component['myIdentities'] = ['bob'];
            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve(true)
            });

            let mockRemoveIdentity = sinon.stub(component, 'removeIdentity').returns(Promise.resolve());
            let mockLoadAllIdentities = sinon.stub(component, 'loadAllIdentities').returns(Promise.resolve());
            mockClientService.revokeIdentity.returns(Promise.resolve());

            component.revokeIdentity({name: 'fred', ref: '1234'});

            tick();

            mockClientService.revokeIdentity.should.have.been.called;
            mockRemoveIdentity.should.not.have.been.called;
            mockLoadAllIdentities.should.have.been.called;

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.successStatus$.next.should.have.been.called;
        }));

        it('should handle error', fakeAsync(() => {
            mockModal.open = sinon.stub().returns({
                componentInstance: {},
                result: Promise.resolve(true)
            });

            mockClientService.revokeIdentity.returns(Promise.reject('some error'));

            let mockRemoveIdentity = sinon.stub(component, 'removeIdentity');
            let mockLoadAllIdentities = sinon.stub(component, 'loadAllIdentities');

            component.revokeIdentity({name: 'fred'});

            tick();

            mockClientService.revokeIdentity.should.have.been.called;
            mockRemoveIdentity.should.not.have.been.called;
            mockLoadAllIdentities.should.not.have.been.called;

            mockAlertService.busyStatus$.next.should.have.been.called;
            mockAlertService.errorStatus$.next.should.have.been.called;
        }));
    });
});
